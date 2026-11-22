// three/ribbon.js — the track as a glowing ribbon: dark tarmac, a white core,
// a red edge on one side and a blue edge on the other. Bright colours glow
// because of the "bloom" effect (see view.js).
import * as THREE from "three";

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
  const m = new THREE.MeshBasicMaterial({ color: colour, transparent: opacity < 1, opacity, side: THREE.DoubleSide, toneMapped: false });
  return new THREE.Mesh(g, m);
}

export function makeRibbon(track) {
  const group = new THREE.Group();
  const P = track.points;
  group.add(strip(P, -1.6, 1.6, 0.02, 0x0d1018));                       // tarmac
  group.add(strip(P, -0.18, 0.18, 0.05, new THREE.Color(1.25, 1.25, 1.4))); // white core (bright → glows)
  const red = strip(P, 1.15, 1.45, 0.04, new THREE.Color(1.9, 0.05, 0.12));
  const blue = strip(P, -1.45, -1.15, 0.04, new THREE.Color(0.1, 0.3, 2.2));
  group.add(red, blue);

  // Start/finish line: a short bright bar across the track at point 0.
  const s = P[0];
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 3.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(2, 2, 2), toneMapped: false }));
  bar.position.set(s.x, 0.06, s.z);
  bar.rotation.y = -Math.atan2(s.dz, s.dx);
  group.add(bar);

  // Under the safety car both edges turn yellow.
  const normal = { red: red.material.color.clone(), blue: blue.material.color.clone() };
  const yellow = new THREE.Color(1.3, 1.0, 0.03);
  group.userData.setSafetyCar = (on) => {
    red.material.color.copy(on ? yellow : normal.red);
    blue.material.color.copy(on ? yellow : normal.blue);
  };
  return group;
}
