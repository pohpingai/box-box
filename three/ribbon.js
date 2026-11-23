// three/ribbon.js — the track as a thin glowing neon line: a bright
// purple-white core with a soft purple haze around it. Bright colours glow
// because of the "bloom" effect (see view.js). Under the safety car the haze
// turns yellow.
import * as THREE from "../vendor/three/three.module.min.js";

// One flat strip that follows the track, from `inner` to `outer` units off the centre line.
function strip(points, inner, outer, y, colour, opacity = 1) {
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
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  return new THREE.Mesh(g, m);
}

export function makeRibbon(track) {
  const group = new THREE.Group();
  const P = track.points;
  const PURPLE = new THREE.Color(0.9, 0.35, 1.8);
  const haze = strip(P, -1.4, 1.4, 0.03, PURPLE, 0.12);                       // wide soft glow
  const glow = strip(P, -0.55, 0.55, 0.04, PURPLE, 0.6);                     // purple tube
  const core = strip(P, -0.16, 0.16, 0.05, new THREE.Color(1.6, 1.35, 2.0));   // white-hot core
  group.add(haze, glow, core);

  // Start/finish line: a short bright bar across the track at point 0.
  const s = P[0];
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 3), new THREE.MeshBasicMaterial({ color: new THREE.Color(2, 2, 2), toneMapped: false }));
  bar.position.set(s.x, 0.06, s.z);
  bar.rotation.y = -Math.atan2(s.dz, s.dx);
  group.add(bar);

  // Under the safety car the glow turns yellow.
  const yellow = new THREE.Color(1.0, 0.78, 0.04);
  group.userData.setSafetyCar = (on) => {
    haze.material.color.copy(on ? yellow : PURPLE);
    glow.material.color.copy(on ? yellow : PURPLE);
  };
  return group;
}
