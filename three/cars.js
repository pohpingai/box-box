// three/cars.js — Team A and Team B as small glowing race cars, each with a
// long light trail behind it (teal for A, orange for B).
//
// How they move (honest, simple): the race engine works in whole laps, so the
// leader goes once round the track during each lap's playback, and the other
// car sits behind it by its real time gap (90s gap = a whole lap behind).
// The gap slides smoothly from the old value to the new one during the lap.
import * as THREE from "../vendor/three/three.module.min.js";

export const TEAM_COLOURS = { A: "#00e0c6", B: "#ffa020" };
const LAP_SECONDS = 90;    // how much time one trip round the track stands for
const TRAIL = 120;         // points in each light trail
const TRAIL_LENGTH = 0.2;  // trail length, as a share of the lap
const TRAIL_WIDTH = 0.9;   // trail width right behind the car
const LANE = { A: 0.55, B: -0.55 }; // each car keeps to its own side of the road, so the two trails
                                    // don't sit on top of each other (teal + orange on top of each other looks white)
const SCALE = 1.7;         // car size (1 = about 4 metres long; drawn bigger than life so you can see them)

export function makeCars(track) {
  const group = new THREE.Group();
  const cars = {};
  for (const team of ["A", "B"]) {
    const c = new THREE.Color(TEAM_COLOURS[team]);
    const body = carShape(c);
    const trail = makeTrail(c);
    group.add(body, trail);
    cars[team] = { body, trail, s: 0, pool: body.userData.pool, lane: LANE[team] };
  }
  let speaking = null; // the team whose engineer is on the radio: its glow pool pulses

  // Lap playback state.
  let from = { A: 0, B: 0 }, to = { A: 0, B: 0 }; // how far behind the leader (share of a lap)
  let progress = 1, moving = false;

  // How far behind the race leader each car is, as a share of a lap.
  function offsets(frame) {
    const lead = Math.min(...frame.cars.map((c) => c.time));
    const out = {};
    frame.cars.forEach((c) => (out[c.team] = Math.min((c.time - lead) / LAP_SECONDS, 0.95)));
    return out;
  }

  return {
    group,
    // New lap result. animate=false (replay slider, the start) = just jump there.
    setFrame(frame, animate) {
      const o = offsets(frame);
      from = animate ? current() : o;
      to = o;
      progress = animate ? 0 : 1;
      moving = animate && frame.lap > 0;
    },
    // p = how much of this lap's playback is done (0..1).
    update(p) {
      progress = p;
      const e = ease(p);
      for (const team of ["A", "B"]) {
        const off = from[team] + (to[team] - from[team]) * e;
        const s = (moving ? p : 0) - off;
        place(cars[team], s);
        // On the radio: the glow under the car grows and pulses.
        const pulse = team === speaking ? 0.5 + 0.5 * Math.sin(performance.now() / 110) : -1;
        const pool = cars[team].pool;
        pool.material.opacity = pulse < 0 ? 0.12 : 0.3 + 0.3 * pulse;
        pool.scale.set(pulse < 0 ? 1.6 : 2.6, 1, pulse < 0 ? 1 : 1.6);
      }
    },
    position(team) { return cars[team].body.position; },
    setSpeaking(team) { speaking = team; },
  };

  function current() {
    const e = ease(progress), out = {};
    for (const t of ["A", "B"]) out[t] = from[t] + (to[t] - from[t]) * e;
    return out;
  }

  function place(car, s) {
    car.s = s;
    const p = track.pointAt(s);
    car.body.position.set(p.x - p.dz * car.lane, 0.1, p.z + p.dx * car.lane);
    car.body.rotation.y = -Math.atan2(p.dz, p.dx); // nose points along the track

    // The trail: a flat glowing strip along the track behind the car, thinning out.
    const arr = car.trail.geometry.attributes.position.array;
    for (let i = 0; i < TRAIL; i++) {
      const q = track.pointAt(s - 0.002 - (i / (TRAIL - 1)) * TRAIL_LENGTH);
      const w = (TRAIL_WIDTH / 2) * (1 - i / TRAIL) ** 0.6;
      const nx = -q.dz, nz = q.dx, cx = q.x + nx * car.lane, cz = q.z + nz * car.lane;
      arr.set([cx + nx * w, 0.12, cz + nz * w, cx - nx * w, 0.12, cz - nz * w], i * 6);
    }
    car.trail.geometry.attributes.position.needsUpdate = true;
    car.trail.geometry.computeBoundingSphere();
  }
}

// A tiny low-poly F1 car, built from boxes along the +x direction (nose at +x):
// a glowing team-colour body, a white cockpit, dark wheels, front and rear wings,
// and a soft glow on the ground underneath.
function carShape(c) {
  const g = new THREE.Group();
  const glow = c.clone().multiplyScalar(1.15);
  const mat = (col, extra = {}) => new THREE.MeshBasicMaterial({ color: col, toneMapped: false, ...extra });
  const box = (w, h, d, x, y, z, m) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(x, y, z);
    g.add(b);
  };
  const bodyM = mat(glow), whiteM = mat(new THREE.Color(1.3, 1.3, 1.4)), darkM = mat(0x0b0b14);
  box(2.6, 0.32, 0.55, 0, 0.32, 0, bodyM);      // main body
  box(1.0, 0.18, 0.3, 1.7, 0.26, 0, bodyM);     // nose
  box(0.22, 0.06, 1.5, 2.2, 0.18, 0, whiteM);   // front wing
  box(0.25, 0.4, 1.3, -1.35, 0.6, 0, bodyM);    // rear wing
  box(1.1, 0.22, 1.1, -0.2, 0.3, 0, bodyM);     // side pods
  box(0.45, 0.18, 0.32, 0.35, 0.55, 0, whiteM); // cockpit / halo
  for (const [x, z] of [[1.15, 0.62], [1.15, -0.62], [-0.9, 0.66], [-0.9, -0.66]]) box(0.5, 0.42, 0.28, x, 0.26, z, darkM);
  // Glow pool on the ground under the car.
  const pool = new THREE.Mesh(new THREE.CircleGeometry(1.8, 24), mat(c.clone().multiplyScalar(1.2), {
    transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.05;
  pool.scale.set(1.6, 1, 1); // stretched along the car
  g.add(pool);
  g.userData.pool = pool;
  g.scale.setScalar(SCALE);
  return g;
}

// The light trail: a strip of TRAIL pairs of points, bright team colour
// (teal / orange) right behind the car, fading to nothing at the far end.
function makeTrail(c) {
  const bright = c.clone().multiplyScalar(1.6);
  const pos = new Float32Array(TRAIL * 6), col = new Float32Array(TRAIL * 6), idx = [];
  for (let i = 0; i < TRAIL; i++) {
    const k = (1 - i / TRAIL) ** 1.4;
    const hot = Math.max(0, 1 - i / 8) * 0.2; // only a hint of white at the start, so the colour stays
    const r = (bright.r + hot) * k, g = (bright.g + hot) * k, b = (bright.b + hot) * k;
    col.set([r, g, b, r, g, b], i * 6);
    if (i < TRAIL - 1) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    vertexColors: true, toneMapped: false, transparent: true, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
}

function ease(t) { return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2; }
