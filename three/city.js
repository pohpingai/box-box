// three/city.js — the "hologram" city: an endless black floor with a faint
// purple grid, and buildings drawn as glowing WIREFRAMES (edges + window lines
// only, no solid walls), in purple and gold. Most of them are packed inside the
// circuit, with a few tall towers in the middle. Small light posts line the
// track and little gold trees dot the ground.
// The layout comes from a fixed seed, so the city looks the same on every
// visit. (Its own random numbers: the race is untouched.)
import * as THREE from "../vendor/three/three.module.min.js";
import { makeRng } from "../race.js";

// Bright colours (above 1) glow through the "bloom" effect.
const PURPLE = new THREE.Color(0.62, 0.26, 1.25);
const GOLD = new THREE.Color(1.15, 0.7, 0.22);

export function makeCity(track) {
  const rng = makeRng("vegas-city");
  const group = new THREE.Group();
  group.add(floor(track));

  // Is (x, z) too close to the track? Buildings stay off it.
  const near = (x, z, d) => track.points.some((p, i) => i % 3 === 0 && (p.x - x) ** 2 + (p.z - z) ** 2 < d * d);
  const inside = (x, z) => insideLoop(track.points, x, z);
  // Keep clear of the two landmarks (the Sphere and the Ferris wheel).
  const clear = (x, z, r) => !track.landmarkSpots.some((s) => Math.hypot(s.x - x, s.z - z) < s.r + r);

  const boxes = layout(rng, track, near, inside, clear);
  group.add(wireframes(boxes));
  group.add(windowFill(boxes));
  group.add(lightPosts(track));
  group.add(trees(rng, track, near, inside, clear, boxes));
  return group;
}

// An "endless" black floor: a huge plane plus a purple grid that fades into
// the fog in the distance, so you never see where it ends.
function floor(track) {
  const g = new THREE.Group();
  const size = track.radius * 16;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  ground.rotation.x = -Math.PI / 2;
  g.add(ground);
  const grid = new THREE.GridHelper(size, Math.round(size / 12), 0x4a2490, 0x2e1660);
  grid.position.y = 0.01;
  grid.material.transparent = true;
  grid.material.opacity = 0.85;
  g.add(grid);

  // Tiny purple dots where the grid lines cross (like a hologram table).
  const pos = [], step = 12, half = track.radius * 4;
  for (let x = -half; x <= half; x += step) for (let z = -half; z <= half; z += step) pos.push(x, 0.05, z);
  const dots = new THREE.BufferGeometry();
  dots.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.add(new THREE.Points(dots, new THREE.PointsMaterial({ color: new THREE.Color(0.5, 0.25, 0.9), size: 0.45, toneMapped: false })));
  return g;
}

// Where the buildings go. Inside the loop: a dense cluster, taller towards the
// middle, plus a handful of skyscrapers. Outside: a few low blocks.
function layout(rng, track, near, inside, clear) {
  const boxes = [];
  const R = track.radius;
  const fits = (b) => clear(b.x, b.z, Math.max(b.w, b.d) / 2 + 1) &&
    !boxes.some((o) => Math.abs(o.x - b.x) < (o.w + b.w) / 2 + 1.6 && Math.abs(o.z - b.z) < (o.d + b.d) / 2 + 1.6);

  // A few tall towers first, so they get the best spots in the middle.
  const towers = [[-2, 14, 34], [8, -8, 46], [-10, -32, 28], [10, 34, 24], [-12, 44, 38], [4, 64, 20], [-4, -56, 22]];
  for (const [x, z, h] of towers) {
    const b = { x, z, w: 4 + rng() * 2, d: 4 + rng() * 2, h, gold: h > 30, tower: true };
    if (inside(x, z) && !near(x, z, 5) && fits(b)) boxes.push(b);
  }

  for (let tries = 0; tries < 5000 && boxes.length < 115; tries++) {
    const x = (rng() - 0.5) * R * 1.4, z = (rng() - 0.5) * R * 2.1;
    const w = 2.5 + rng() * 5, d = 2.5 + rng() * 5;
    if (!inside(x, z) || near(x, z, Math.max(w, d) / 2 + 3)) continue;
    const middle = 1 - Math.min(1, Math.hypot(x / (R * 0.6), z / R));
    const b = { x, z, w, d, h: 2 + rng() * (4 + middle * 14), gold: rng() < 0.35 };
    if (fits(b)) boxes.push(b);
  }
  // A thin ring of low blocks outside the circuit, so the city doesn't stop dead at the track.
  for (let tries = 0; tries < 1500 && boxes.length < 150; tries++) {
    const a = rng() * Math.PI * 2, r = R * (0.75 + rng() * 0.55);
    const x = Math.cos(a) * r * 0.75, z = Math.sin(a) * r * 1.05;
    const w = 3 + rng() * 5, d = 3 + rng() * 5;
    if (inside(x, z) || near(x, z, Math.max(w, d) / 2 + 4)) continue;
    const b = { x, z, w, d, h: 1.5 + rng() * 6, gold: rng() < 0.3 };
    if (fits(b)) boxes.push(b);
  }
  return boxes;
}

// All the glowing lines of all the buildings, in one go (one draw = fast on phones):
// the 12 box edges, window bands every 1.6 units of height, and a few
// vertical lines on each face. Towers taper towards the top.
function wireframes(boxes) {
  const pos = [], col = [];
  const line = (a, b, c, ka, kb) => {
    pos.push(...a, ...b);
    col.push(c.r * ka, c.g * ka, c.b * ka, c.r * kb, c.g * kb, c.b * kb);
  };
  for (const b of boxes) {
    const c = b.gold ? GOLD : PURPLE;
    const taper = b.tower ? 0.7 : 1; // the top is a bit narrower than the bottom
    const corners = (y) => {
      const s = 1 - (1 - taper) * (y / b.h);
      const hw = (b.w / 2) * s, hd = (b.d / 2) * s;
      return [[b.x - hw, y, b.z - hd], [b.x + hw, y, b.z - hd], [b.x + hw, y, b.z + hd], [b.x - hw, y, b.z + hd]];
    };
    const bright = (y) => 0.35 + 0.65 * (y / b.h); // tops brightest, bottoms fade into the dark
    const bottom = corners(0), top = corners(b.h);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      line(bottom[i], bottom[j], c, 0.3, 0.3);
      line(top[i], top[j], c, 1.1, 1.1);
      line(bottom[i], top[i], c, 0.3, 1.1);
    }
    // Window bands (one per floor).
    for (let y = 1.6; y < b.h - 0.4; y += 1.6) {
      const ring = corners(y), k = bright(y) * 0.55;
      for (let i = 0; i < 4; i++) line(ring[i], ring[(i + 1) % 4], c, k, k);
    }
    // Vertical window lines on each face.
    const cols = Math.max(1, Math.round(Math.max(b.w, b.d) / 1.6));
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      for (let n = 1; n < cols; n++) {
        const u = n / cols;
        const lerp = (p, q) => p.map((v, k) => v + (q[k] - v) * u);
        line(lerp(bottom[i], bottom[j]), lerp(top[i], top[j]), c, 0.12, 0.45);
      }
    }
    // A spire on the tallest towers.
    if (b.h > 30) line([b.x, b.h, b.z], [b.x, b.h + 8, b.z], c, 1.4, 1.4);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, toneMapped: false }));
}

// A very faint see-through tint inside each building, like lit glass,
// so the wireframes read as solid shapes rather than a tangle of lines.
function windowFill(boxes) {
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.035, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    boxes.length,
  );
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  boxes.forEach((b, i) => {
    const s = b.tower ? 0.85 : 1;
    m.compose(new THREE.Vector3(b.x, b.h / 2, b.z), q, new THREE.Vector3(b.w * s, b.h, b.d * s));
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, b.gold ? GOLD : PURPLE);
  });
  return mesh;
}

// Little light posts along both sides of the track: a short line with a bright dot on top.
function lightPosts(track) {
  const stems = [], tops = [];
  track.points.forEach((p, i) => {
    if (i % 22) return;
    for (const side of [-1, 1]) {
      const x = p.x + p.nx * 3.2 * side, z = p.z + p.nz * 3.2 * side;
      stems.push(x, 0, z, x, 2.2, z);
      tops.push(x, 2.3, z);
    }
  });
  const g = new THREE.Group();
  const sg = new THREE.BufferGeometry();
  sg.setAttribute("position", new THREE.Float32BufferAttribute(stems, 3));
  g.add(new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: new THREE.Color(0.7, 0.35, 1.3), toneMapped: false, transparent: true, opacity: 0.7 })));
  const tg = new THREE.BufferGeometry();
  tg.setAttribute("position", new THREE.Float32BufferAttribute(tops, 3));
  g.add(new THREE.Points(tg, new THREE.PointsMaterial({ color: new THREE.Color(1.4, 1.0, 1.7), size: 0.7, toneMapped: false })));
  return g;
}

// Little gold trees (a short trunk and a glowing dot of leaves) between the buildings.
function trees(rng, track, near, inside, clear, boxes) {
  const trunks = [], leaves = [];
  const inBuilding = (x, z) => boxes.some((b) => Math.abs(b.x - x) < b.w / 2 + 0.8 && Math.abs(b.z - z) < b.d / 2 + 0.8);
  const R = track.radius;
  for (let tries = 0; tries < 3000 && leaves.length < 240 * 3; tries++) {
    const x = (rng() - 0.5) * R * 1.6, z = (rng() - 0.5) * R * 2.2;
    if (near(x, z, 2.6) || inBuilding(x, z) || !clear(x, z, 0.5)) continue;
    if (!inside(x, z) && rng() < 0.6) continue; // most trees inside the circuit
    const h = 0.8 + rng() * 0.6;
    trunks.push(x, 0, z, x, h, z);
    leaves.push(x, h + 0.35, z);
  }
  const g = new THREE.Group();
  const tg = new THREE.BufferGeometry();
  tg.setAttribute("position", new THREE.Float32BufferAttribute(trunks, 3));
  g.add(new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ color: new THREE.Color(0.6, 0.4, 0.15), toneMapped: false })));
  const lg = new THREE.BufferGeometry();
  lg.setAttribute("position", new THREE.Float32BufferAttribute(leaves, 3));
  g.add(new THREE.Points(lg, new THREE.PointsMaterial({ color: new THREE.Color(1.1, 0.75, 0.25), size: 0.8, toneMapped: false })));
  return g;
}

// Is the point (x, z) inside the track loop? ("Ray casting": count how many
// times a line going right from the point crosses the track. Odd = inside.)
function insideLoop(points, x, z) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}
