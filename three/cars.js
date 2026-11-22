// three/cars.js — Team A and Team B as glowing dots with light trails.
//
// How they move (honest, simple): the race engine works in whole laps, so the
// leader goes once round the track during each lap's playback, and the other
// car sits behind it by its real time gap (90s gap = a whole lap behind).
// The gap slides smoothly from the old value to the new one during the lap.
import * as THREE from "../vendor/three/three.module.min.js";

export const TEAM_COLOURS = { A: "#00d2be", B: "#ff8a00" };
const LAP_SECONDS = 90;   // how much time one trip round the track stands for
const TRAIL = 36;         // points in each light trail
const TRAIL_LENGTH = 0.05; // trail length, as a share of the lap

export function makeCars(track) {
  const group = new THREE.Group();
  const cars = {};
  for (const team of ["A", "B"]) {
    const c = new THREE.Color(TEAM_COLOURS[team]).multiplyScalar(1.5);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(1.3, 20, 14), new THREE.MeshBasicMaterial({ color: c, toneMapped: false }));
    const halo = new THREE.Mesh(new THREE.SphereGeometry(2.4, 20, 14), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.18, toneMapped: false, depthWrite: false }));
    dot.add(halo);

    const pos = new Float32Array(TRAIL * 3), col = new Float32Array(TRAIL * 3);
    for (let i = 0; i < TRAIL; i++) {
      const k = (1 - i / TRAIL) ** 1.6; // bright at the car, fading behind it
      col.set([c.r * k, c.g * k, c.b * k], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const trail = new THREE.Line(g, new THREE.LineBasicMaterial({ vertexColors: true, toneMapped: false, transparent: true, blending: THREE.AdditiveBlending }));
    group.add(dot, trail);
    cars[team] = { dot, trail, s: 0 };
  }

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
      }
    },
    position(team) { return cars[team].dot.position; },
  };

  function current() {
    const e = ease(progress), out = {};
    for (const t of ["A", "B"]) out[t] = from[t] + (to[t] - from[t]) * e;
    return out;
  }

  function place(car, s) {
    car.s = s;
    const p = track.pointAt(s);
    car.dot.position.set(p.x, 1.4, p.z);
    const arr = car.trail.geometry.attributes.position.array;
    for (let i = 0; i < TRAIL; i++) {
      const q = track.pointAt(s - (i / TRAIL) * TRAIL_LENGTH);
      arr.set([q.x, 1.0, q.z], i * 3);
    }
    car.trail.geometry.attributes.position.needsUpdate = true;
  }
}

function ease(t) { return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2; }
