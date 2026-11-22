// three/landmarks.js — two simple Vegas landmarks, roughly where the real ones are:
// a big glowing sphere and a Ferris wheel. Both turn slowly (see update()).
import * as THREE from "three";

// Approximate real spots (longitude, latitude), put on the map with the track's own projector.
const SPHERE_AT = [-115.1618, 36.1207];
const WHEEL_AT = [-115.1683, 36.1176];

export function makeLandmarks(track) {
  const group = new THREE.Group();
  const sphere = makeSphere();
  const s = track.project(SPHERE_AT);
  sphere.position.set(s.x, 0, s.z);
  const wheel = makeWheel();
  const w = track.project(WHEEL_AT);
  wheel.position.set(w.x, 0, w.z);
  group.add(sphere, wheel);

  group.userData.update = (t) => {
    sphere.userData.shell.rotation.y = t * 0.15;
    // The sphere slowly shifts colour, like the real one's screen.
    sphere.userData.shell.material.color.setHSL(0.62 + 0.12 * Math.sin(t * 0.2), 0.9, 0.55).multiplyScalar(1.8);
    wheel.userData.spin.rotation.z = t * 0.06;
  };
  return group;
}

// Radius 8 units = 80 metres (the real one is about 160 m wide).
function makeSphere() {
  const r = 8, g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(r * 0.97, 40, 24), new THREE.MeshBasicMaterial({ color: 0x120a2a }));
  const shell = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 16), new THREE.MeshBasicMaterial({ wireframe: true, toneMapped: false, transparent: true, opacity: 0.8 }));
  core.position.y = shell.position.y = r * 0.85;
  g.add(core, shell);
  g.userData.shell = shell;
  return g;
}

// Ring + spokes + little cabins, on two legs. Radius 7.5 units = 75 metres.
function makeWheel() {
  const R = 7.5, hub = R + 1, g = new THREE.Group();
  const glow = (r, gr, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, gr, b), toneMapped: false });
  const spin = new THREE.Group();
  spin.position.y = hub;
  spin.add(new THREE.Mesh(new THREE.TorusGeometry(R, 0.12, 8, 64), glow(2.2, 0.5, 1.6)));
  spin.add(new THREE.Mesh(new THREE.TorusGeometry(R * 0.35, 0.08, 6, 32), glow(1.4, 0.4, 1.2)));
  const spokes = [];
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    spokes.push(0, 0, 0, Math.cos(a) * R, Math.sin(a) * R, 0);
    if (i % 2 === 0) {
      const cab = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), glow(2.2, 1.6, 0.6));
      cab.position.set(Math.cos(a) * R, Math.sin(a) * R, 0);
      spin.add(cab);
    }
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute("position", new THREE.Float32BufferAttribute(spokes, 3));
  spin.add(new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: new THREE.Color(0.9, 0.35, 0.9), toneMapped: false, transparent: true, opacity: 0.6 })));

  // Two legs from the ground to the hub.
  const legs = new THREE.BufferGeometry();
  legs.setAttribute("position", new THREE.Float32BufferAttribute([-3, 0, 0, 0, hub, 0, 3, 0, 0, 0, hub, 0], 3));
  g.add(new THREE.LineSegments(legs, new THREE.LineBasicMaterial({ color: new THREE.Color(0.8, 0.5, 1.0), toneMapped: false })));
  g.add(spin);
  g.rotation.y = 0.5; // turned a little so the drone sees it at an angle
  g.userData.spin = spin;
  return g;
}
