// three/director.js — the TV director: chooses the camera, like an F1 broadcast.
//
// Shots:
//   CHASE    — low, just behind a car (usually the one in second), looking down the road (slight lag).
//   TURN n   — a fixed trackside camera at a corner; it pans to follow the cars
//              as they come past, then rests on the corner.
//   HELI     — a helicopter slowly circling the dome, cars passing below.
//   OVERVIEW — the whole circuit; only before the start, at the finish and while paused.
//
// It cuts to a new shot every 6–8 seconds, and straight away on a big moment
// (pit stop, overtake, safety car) — that shot stays up even if the race
// auto-pauses for the moment. Every cut is a quick 0.4 s fade through black.
// For screenshots/tests, `?cam=chase|turn|heli|overview` locks one shot.
import * as THREE from "../vendor/three/three.module.min.js";

const FADE = 0.4;                     // seconds for a cut (fade out + fade in)
const SHOT_MIN = 6, SHOT_MAX = 8;     // seconds between automatic cuts
const OVERVIEW = { centre: new THREE.Vector3(-6, 8, 8), range: 180, down: (25 * Math.PI) / 180, orbit: 150 };
const HELI = { radius: 70, height: 72, orbit: 80 }; // high enough to clear every building

export function makeDirector(camera, track, cars, spots, dome, { reduceMotion, lock }) {
  const L = track.points.length * 0.5; // lap length in units
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647); // its own dice: the race is untouched
  let shot = { kind: "overview" }, pending = null, fadeT = null, age = 0, len = 7, snap = true;
  let orbit = 0.6, heliAngle = 0;
  let hold = 0; // seconds an event shot stays up, even if the race auto-pauses for it
  const pos = new THREE.Vector3(), look = new THREE.Vector3();
  const want = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  let fade = 0, focus = 100, aperture = 0;

  // Which trackside camera will the car reach soonest?
  function nextCorner(team) {
    const s = ((cars.progress(team) % 1) + 1) % 1;
    let best = spots[0], bestAhead = 2;
    for (const c of spots) {
      const ahead = (((c.at - s) % 1) + 1) % 1;
      if (ahead > 0.03 && ahead < bestAhead) { best = c; bestAhead = ahead; }
    }
    return best;
  }

  function pick(leader) {
    if (lock) return lock === "turn" ? { kind: "turn", spot: nextCorner(leader) } : { kind: lock, team: leader === "A" ? "B" : "A" };
    const options = ["chase", "chase", "turn", "turn", "heli"].filter((k) => k !== shot.kind);
    const kind = options[Math.floor(rand() * options.length)];
    if (kind === "turn") return { kind, spot: nextCorner(leader) };
    // Chase cam usually rides behind the car in SECOND, so the battle is in shot
    // (behind the leader, the other car would often be in the way).
    const chaser = leader === "A" ? "B" : "A";
    return { kind, team: kind === "chase" && rand() < 0.75 ? chaser : leader };
  }

  function cut(next) {
    pending = next;
    if (fadeT === null) fadeT = 0;
  }

  // Where the camera wants to be for the current shot.
  function aim(dt, aspect, leader) {
    switch (shot.kind) {
      case "chase": {
        // Right behind the car (in its own lane), looking down the road ahead.
        const team = shot.team || leader, s = cars.progress(team), car = cars.position(team);
        const d = track.pointAt(s), a = track.pointAt(s + 14 / L);
        want.pos.set(car.x - d.dx * 6.5, 2.3, car.z - d.dz * 6.5);
        want.look.set((car.x + d.dx * 12 + a.x) / 2, 1.0, (car.z + d.dz * 12 + a.z) / 2);
        focus = pos.distanceTo(car);
        aperture = 0.00025;
        return { fov: 55, rate: 22 };
      }
      case "turn": {
        const c = shot.spot, car = cars.position(leader);
        want.pos.set(c.cam.x, c.cam.y, c.cam.z);
        // Follow the car while it's near this corner; otherwise rest on the apex.
        if (Math.hypot(car.x - c.apex.x, car.z - c.apex.z) < 60) want.look.set(car.x, 1, car.z);
        else want.look.set(c.apex.x + c.inward.x * 6, 2, c.apex.z + c.inward.z * 6);
        focus = pos.distanceTo(want.look);
        aperture = 0.0003;
        return { fov: 34, rate: 5 };
      }
      case "heli": {
        if (!reduceMotion) heliAngle += (dt / HELI.orbit) * Math.PI * 2;
        want.pos.set(dome.x + Math.cos(heliAngle) * HELI.radius, HELI.height, dome.z + Math.sin(heliAngle) * HELI.radius);
        want.look.set(dome.x, 8, dome.z);
        focus = pos.distanceTo(want.look);
        aperture = 0.00015;
        return { fov: 42, rate: 3 };
      }
      default: { // overview
        if (!reduceMotion) orbit += (dt / OVERVIEW.orbit) * Math.PI * 2;
        const range = OVERVIEW.range * (aspect < 1 ? 1.45 : 1), flat = range * Math.cos(OVERVIEW.down);
        const c = OVERVIEW.centre;
        want.pos.set(c.x + Math.cos(orbit) * flat, c.y + range * Math.sin(OVERVIEW.down), c.z + Math.sin(orbit) * flat);
        want.look.copy(c);
        focus = 200;
        aperture = 0;
        return { fov: 45, rate: 4 };
      }
    }
  }

  return {
    get fade() { return fade; },
    get focus() { return focus; },
    get aperture() { return aperture; },
    get kind() { return shot.kind; },
    label() {
      if (shot.kind === "chase") return `CHASE · ${shot.team}`;
      if (shot.kind === "turn") return shot.spot.name;
      return shot.kind.toUpperCase();
    },
    // A big moment: cut to it straight away (not while showing the overview).
    moment(kind, team) {
      if (lock || reduceMotion) return;
      hold = SHOT_MAX;
      cut(kind === "overtake" && rand() < 0.5 ? { kind: "turn", spot: nextCorner(team) } : { kind: "chase", team });
    },
    // ctx = { overview: true when the race hasn't started, is over, or is paused; leader: "A"/"B" }
    update(dt, aspect, ctx) {
      const leader = ctx.leader;
      hold = Math.max(0, hold - dt);
      const wantOverview = (ctx.overview && hold === 0) || reduceMotion || lock === "overview";
      if (wantOverview && shot.kind !== "overview" && pending?.kind !== "overview") cut({ kind: "overview" });
      if (!wantOverview && shot.kind === "overview" && !pending) cut(pick(leader));
      if (!wantOverview && shot.kind !== "overview" && !pending && (age += dt) > len && (!lock || lock === "turn")) cut(pick(leader));
      if (shot.kind === "chase" && !shot.team) shot.team = leader;

      // The fade: down to black, switch shot in the dark, back up.
      if (fadeT !== null) {
        fadeT += dt;
        if (fadeT >= FADE / 2 && pending) {
          shot = pending; pending = null; age = 0; len = SHOT_MIN + rand() * (SHOT_MAX - SHOT_MIN); snap = true;
          if (shot.kind === "chase" && !shot.team) shot.team = leader;
        }
        fade = fadeT < FADE / 2 ? fadeT / (FADE / 2) : Math.max(0, 1 - (fadeT - FADE / 2) / (FADE / 2));
        if (fadeT >= FADE && !pending) { fadeT = null; fade = 0; }
      }

      const { fov, rate } = aim(dt, aspect, leader);
      if (snap) { pos.copy(want.pos); look.copy(want.look); snap = false; }
      const k = 1 - Math.exp(-dt * rate); // smooth follow (the "slight lag")
      pos.lerp(want.pos, k);
      look.lerp(want.look, Math.min(1, k * 1.3));
      camera.position.copy(pos);
      camera.lookAt(look);
      if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
      if (shot.kind === "overview") focus = pos.distanceTo(look);
    },
  };
}
