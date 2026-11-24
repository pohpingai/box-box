// three/ribbon.js — the track as a purple neon ROAD: a dark road surface
// (about 30 m wide, so the cars fit on it) with a glowing purple line along each edge, a soft purple
// haze spilling round the edges, and a faint purple line down the middle.
// Bright colours glow because of the "bloom" effect (see view.js).
// Under the safety car the edges and haze turn yellow.
import * as THREE from "../vendor/three/three.module.min.js";

// One flat strip that follows the track, from `inner` to `outer` units off the centre line.
function strip(points, inner, outer, y, colour, opacity = 1, glow = true) {
  const pos = [];
  const idx = [];
  points.forEach((p, i) => {
    pos.push(p.x + p.nx * inner, y, p.z + p.nz * inner, p.x + p.nx * outer, y, p.z + p.nz * outer);
    const a = i * 2, b = ((i + 1) % points.length) * 2;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const m = new THREE.MeshBasicMaterial({
    color: colour, transparent: true, opacity, side: THREE.DoubleSide, toneMapped: false,
    blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false,
  });
  return new THREE.Mesh(g, m);
}

export function makeRibbon(track) {
  const group = new THREE.Group();
  const P = track.points;
  const PURPLE = new THREE.Color(0.75, 0.25, 1.6);   // edge glow
  const W = 1.5;                                         // half the road's width (units): 30 m road
  const road = strip(P, -W, W, 0.02, new THREE.Color(0.018, 0.01, 0.03), 0.92, false); // dark tarmac
  const haze = strip(P, -W - 1.0, W + 1.0, 0.025, PURPLE, 0.07);                     // soft spill round the road
  const edges = [-1, 1].map((side) => strip(P, side * W - 0.09, side * W + 0.09, 0.04, PURPLE, 0.95)); // neon edge lines
  const core = strip(P, -0.05, 0.05, 0.035, new THREE.Color(0.55, 0.25, 1.0), 0.35); // faint centre line
  group.add(road, haze, ...edges, core);

  // Start/finish line: a short bright bar across the track at point 0.
  const s = P[0];
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 1.8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.3, 1.2, 1.5), toneMapped: false }));
  bar.position.set(s.x, 0.06, s.z);
  bar.rotation.y = -Math.atan2(s.dz, s.dx);
  group.add(bar);

  // Under the safety car the glow turns yellow.
  const yellow = new THREE.Color(1.0, 0.78, 0.04);
  group.userData.setSafetyCar = (on) => {
    for (const m of [haze, ...edges]) m.material.color.copy(on ? yellow : PURPLE);
  };
  return group;
}
