// three/city.js — the night city around the track: dark ground, a faint grid of
// streets, tiny city lights and simple box buildings with glowing gold edges
// (a few purple/pink ones). The layout comes from a fixed seed, so the city
// looks the same on every visit. (Its own random numbers: the race is untouched.)
import * as THREE from "../vendor/three/three.module.min.js";
import { makeRng } from "../race.js";

const GOLD = [new THREE.Color(2.0, 1.25, 0.35), new THREE.Color(1.6, 0.95, 0.3)];
const NEON = [new THREE.Color(1.6, 0.35, 2.2), new THREE.Color(2.4, 0.4, 1.3)]; // purple, pink

export function makeCity(track) {
  const rng = makeRng("vegas-city");
  const group = new THREE.Group();
  const size = track.radius * 3.2;

  // Ground and the faint street grid.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(size * 2, size * 2), new THREE.MeshBasicMaterial({ color: 0x04050a }));
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);
  const grid = new THREE.GridHelper(size * 2, Math.round(size / 4), 0x1a2340, 0x10162a);
  grid.position.y = 0.01;
  grid.material.transparent = true;
  grid.material.opacity = 0.55;
  group.add(grid);

  // Is (x, z) too close to the track? Buildings and lights stay off it.
  const near = (x, z, d) => track.points.some((p, i) => i % 4 === 0 && (p.x - x) ** 2 + (p.z - z) ** 2 < d * d);

  group.add(cityLights(rng, size, near));
  group.add(buildings(rng, size, near));
  return group;
}

// Thousands of tiny warm dots on the ground, like streetlights seen from a drone.
function cityLights(rng, size, near) {
  const pos = [], col = [];
  for (let i = 0; i < 2600; i++) {
    // Most lights sit on the street grid lines, the rest are scattered.
    let x = (rng() - 0.5) * size * 2, z = (rng() - 0.5) * size * 2;
    if (rng() < 0.6) (rng() < 0.5 ? (x = Math.round(x / 8) * 8) : (z = Math.round(z / 8) * 8));
    if (near(x, z, 2)) continue;
    pos.push(x, 0.08, z);
    const c = rng() < 0.85 ? new THREE.Color(1.4, 0.95, 0.5) : new THREE.Color(0.6, 0.8, 1.6);
    const dim = 0.35 + rng() * 0.65;
    col.push(c.r * dim, c.g * dim, c.b * dim);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ size: 0.35, vertexColors: true, toneMapped: false }));
}

// Simple boxes: a dark body, and glowing edges (gold, sometimes purple/pink).
function buildings(rng, size, near) {
  const boxes = [];
  for (let tries = 0; tries < 900 && boxes.length < 260; tries++) {
    const x = (rng() - 0.5) * size * 1.4, z = (rng() - 0.5) * size * 1.4;
    const w = 1.5 + rng() * 3.5, d = 1.5 + rng() * 3.5;
    // Taller towers near the middle of the city (the Strip), lower ones outside.
    const centre = 1 - Math.min(1, Math.hypot(x, z) / size);
    const h = 1 + rng() * (4 + centre * 16);
    if (near(x, z, Math.max(w, d) / 2 + 2.2)) continue;
    boxes.push({ x, z, w, d, h, neon: rng() < 0.14 });
  }

  const group = new THREE.Group();
  // Bodies: one "instanced" mesh = one draw for all the boxes (fast on phones).
  const body = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ toneMapped: false }), boxes.length);
  const m = new THREE.Matrix4();
  boxes.forEach((b, i) => {
    m.compose(new THREE.Vector3(b.x, b.h / 2, b.z), new THREE.Quaternion(), new THREE.Vector3(b.w, b.h, b.d));
    body.setMatrixAt(i, m);
    const tint = (b.neon ? NEON[i % 2] : GOLD[i % 2]).clone().multiplyScalar(0.06);
    body.setColorAt(i, tint);
  });
  group.add(body);

  // Edges: the 12 edges of every box in one set of lines.
  const pos = [], col = [];
  boxes.forEach((b, i) => {
    const c = b.neon ? NEON[i % 2] : GOLD[i % 2];
    const glow = b.neon ? 1 : 0.55 + (b.h / 21) * 0.6;
    const X = [b.x - b.w / 2, b.x + b.w / 2], Z = [b.z - b.d / 2, b.z + b.d / 2], Y = [0, b.h];
    const corner = (xi, yi, zi) => [X[xi], Y[yi], Z[zi]];
    const edges = [
      [[0,0,0],[1,0,0]], [[0,0,1],[1,0,1]], [[0,1,0],[1,1,0]], [[0,1,1],[1,1,1]],
      [[0,0,0],[0,0,1]], [[1,0,0],[1,0,1]], [[0,1,0],[0,1,1]], [[1,1,0],[1,1,1]],
      [[0,0,0],[0,1,0]], [[1,0,0],[1,1,0]], [[0,0,1],[0,1,1]], [[1,0,1],[1,1,1]],
    ];
    edges.forEach(([a, e]) => {
      pos.push(...corner(...a), ...corner(...e));
      // Tops glow brightest, the bottoms fade into the dark.
      const ka = a[1] ? glow : glow * 0.25, ke = e[1] ? glow : glow * 0.25;
      col.push(c.r * ka, c.g * ka, c.b * ka, c.r * ke, c.g * ke, c.b * ke);
    });
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  group.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, toneMapped: false })));
  return group;
}
