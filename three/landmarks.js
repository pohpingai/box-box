// three/landmarks.js — two Vegas landmarks as glowing gold wireframes, roughly
// where the real ones are: a geodesic dome (the Sphere) and a Ferris wheel.
// The dome turns very slowly and the wheel spins (see update()).
import * as THREE from "../vendor/three/three.module.min.js";

// Approximate real spots (longitude, latitude), put on the map with the track's own projector.
const SPHERE_AT = [-115.1618, 36.1207];
const WHEEL_AT = [-115.1683, 36.1176];
const DOME_R = 11, WHEEL_R = 9;

const GOLD = new THREE.Color(1.4, 0.88, 0.28);
const GOLD_DIM = new THREE.Color(0.7, 0.44, 0.14);
const glowLines = (colour, opacity = 1) => new THREE.LineBasicMaterial({
  color: colour, toneMapped: false, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false,
});

// Where the landmarks stand and how much room they need (the city keeps clear of them).
export function landmarkSpots(track) {
  const s = track.project(SPHERE_AT), w = track.project(WHEEL_AT);
  return [{ x: s.x, z: s.z, r: DOME_R + 3 }, { x: w.x, z: w.z, r: 6 }];
}

export function makeLandmarks(track) {
  const group = new THREE.Group();
  const [s, w] = landmarkSpots(track);
  const dome = makeDome();
  dome.position.set(s.x, 0, s.z);
  const wheel = makeWheel();
  wheel.position.set(w.x, 0, w.z);
  group.add(dome, wheel);

  group.userData.update = (t) => {
    dome.userData.shell.rotation.y = t * 0.03;
    wheel.userData.spin.rotation.z = t * 0.06;
  };
  return group;
}

// A geodesic dome: the triangle edges of a round "icosphere", top 85% only,
// with a glowing ring at the base and a faint golden glow inside.
function makeDome() {
  const R = DOME_R, g = new THREE.Group();
  const ico = new THREE.IcosahedronGeometry(R, 2);
  const edges = new THREE.EdgesGeometry(ico, 1);
  // Cut off the bottom of the ball so it sits on the ground like a dome.
  const cut = -R * 0.45, src = edges.attributes.position.array, kept = [];
  for (let i = 0; i < src.length; i += 6) if (src[i + 1] > cut && src[i + 4] > cut) kept.push(...src.slice(i, i + 6));
  const shellGeo = new THREE.BufferGeometry();
  shellGeo.setAttribute("position", new THREE.Float32BufferAttribute(kept, 3));
  const shell = new THREE.LineSegments(shellGeo, glowLines(GOLD, 0.75));
  shell.position.y = -cut;
  g.add(shell);

  // Faint warm glass inside, so it reads as a solid ball.
  const glass = new THREE.Mesh(new THREE.SphereGeometry(R * 0.98, 32, 20), new THREE.MeshBasicMaterial({
    color: new THREE.Color(0.5, 0.3, 0.1), transparent: true, opacity: 0.035, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  }));
  glass.position.y = -cut;
  g.add(glass);

  // Base rings on the ground.
  const baseR = Math.sqrt(R * R - cut * cut);
  for (const [r, c] of [[baseR, GOLD], [baseR + 2.2, GOLD_DIM], [baseR + 4, GOLD_DIM]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.12, 6, 96), new THREE.MeshBasicMaterial({ color: c, toneMapped: false }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.15;
    g.add(ring);
  }
  g.userData.shell = shell;
  return g;
}

// Ferris wheel: double rim, spokes, cabins, an A-frame on each side.
function makeWheel() {
  const R = WHEEL_R, hub = R + 1.5, g = new THREE.Group();
  const spin = new THREE.Group();
  spin.position.y = hub;
  const rim = (r, z, c) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.1, 6, 72), new THREE.MeshBasicMaterial({ color: c, toneMapped: false }));
    m.position.z = z;
    spin.add(m);
  };
  rim(R, 0.6, GOLD); rim(R, -0.6, GOLD); rim(R * 0.92, 0, GOLD_DIM); rim(0.9, 0, GOLD);

  const spokes = [], N = 32;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2, x = Math.cos(a) * R, y = Math.sin(a) * R;
    spokes.push(0, 0, 0.6, x, y, 0.6, 0, 0, -0.6, x, y, -0.6, x, y, 0.6, x, y, -0.6);
    if (i % 2 === 0) {
      const cab = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.3, 0.5), toneMapped: false }));
      cab.position.set(x, y, 0);
      spin.add(cab);
    }
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute("position", new THREE.Float32BufferAttribute(spokes, 3));
  spin.add(new THREE.LineSegments(sg, glowLines(GOLD, 0.55)));

  // A-frame legs on both sides of the wheel, and a small platform.
  const legs = [];
  for (const z of [-2.2, 2.2]) legs.push(-4.5, 0, z, 0, hub, z * 0.4, 4.5, 0, z, 0, hub, z * 0.4, -4.5, 0, z, 4.5, 0, z);
  const lg = new THREE.BufferGeometry();
  lg.setAttribute("position", new THREE.Float32BufferAttribute(legs, 3));
  g.add(new THREE.LineSegments(lg, glowLines(GOLD)));
  const base = new THREE.Mesh(new THREE.TorusGeometry(6, 0.1, 6, 48), new THREE.MeshBasicMaterial({ color: GOLD_DIM, toneMapped: false }));
  base.rotation.x = Math.PI / 2;
  base.position.y = 0.15;
  g.add(base, spin);
  g.rotation.y = 0.5; // turned a little so the drone sees it at an angle
  g.userData.spin = spin;
  return g;
}
