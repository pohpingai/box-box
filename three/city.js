// three/city.js — the "hologram" city: buildings drawn as glowing WIREFRAMES (edges + window lines
// only, no solid walls), in purple and gold. Only about 30, all inside the
// circuit and mostly round the landmarks, so the landmarks stand out.
// Small light posts stand at even spacing along both edges of the track.
// (The floor is in floor.js.)
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

  // Is (x, z) too close to the track? Buildings stay off it.
  const near = (x, z, d) => track.points.some((p, i) => i % 3 === 0 && (p.x - x) ** 2 + (p.z - z) ** 2 < d * d);
  const inside = (x, z) => insideLoop(track.points, x, z);
  // Keep clear of the landmarks (dome, twisted tower, Ferris wheel — see heroes.js).
  const clear = (x, z, r) => !track.landmarkSpots.some((s) => Math.hypot(s.x - x, s.z - z) < s.r + r);

  const boxes = layout(rng, track, near, inside, clear);
  group.add(wireframes(boxes));
  group.add(windowFill(boxes));
  group.add(lightPosts(track));
  return group;
}

// Where the buildings go: only INSIDE the loop, and only about 30, so the
// landmarks stand out. Most cluster round the landmarks (like a downtown
// around them); a few are spread through the rest of the infield.
const BUILDINGS = 30;
function layout(rng, track, near, inside, clear) {
  const boxes = [];
  const R = track.radius;
  const spots = track.landmarkSpots;
  const fits = (b) => clear(b.x, b.z, Math.max(b.w, b.d) / 2 + 1) &&
    !boxes.some((o) => Math.abs(o.x - b.x) < (o.w + b.w) / 2 + 1.6 && Math.abs(o.z - b.z) < (o.d + b.d) / 2 + 1.6);

  for (let tries = 0; tries < 5000 && boxes.length < BUILDINGS; tries++) {
    let x, z, nearLandmark = rng() < 0.75;
    if (nearLandmark) {
      // A spot in a ring just outside one of the landmarks.
      const s = spots[Math.floor(rng() * spots.length)], a = rng() * Math.PI * 2, d = s.r + 2 + rng() * 16;
      x = s.x + Math.cos(a) * d; z = s.z + Math.sin(a) * d;
    } else {
      x = (rng() - 0.5) * R * 1.4; z = (rng() - 0.5) * R * 2.1;
    }
    const w = 2.5 + rng() * 5, d = 2.5 + rng() * 5;
    if (!inside(x, z) || near(x, z, Math.max(w, d) / 2 + 3)) continue;
    // Next to a landmark: a bit taller, a few true towers. Elsewhere: low blocks.
    const h = nearLandmark ? 4 + rng() * (rng() < 0.2 ? 26 : 12) : 2 + rng() * 6;
    const b = { x, z, w, d, h, gold: rng() < 0.35, tower: h > 20 };
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

// Small light posts at even spacing (every 60 m) along both edges of the road:
// a short purple stem with a soft white-purple light on top.
const POST_EVERY = 12; // track points (0.5 units each) → 6 units = 60 m
function lightPosts(track) {
  const stems = [], tops = [];
  track.points.forEach((p, i) => {
    if (i % POST_EVERY) return;
    for (const side of [-1, 1]) {
      const x = p.x + p.nx * 2.1 * side, z = p.z + p.nz * 2.1 * side;
      stems.push(x, 0, z, x, 1.1, z);
      tops.push(x, 1.15, z);
    }
  });
  const g = new THREE.Group();
  const sg = new THREE.BufferGeometry();
  sg.setAttribute("position", new THREE.Float32BufferAttribute(stems, 3));
  g.add(new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: new THREE.Color(0.5, 0.25, 0.95), toneMapped: false, transparent: true, opacity: 0.6 })));
  const tg = new THREE.BufferGeometry();
  tg.setAttribute("position", new THREE.Float32BufferAttribute(tops, 3));
  g.add(new THREE.Points(tg, new THREE.PointsMaterial({ color: new THREE.Color(1.1, 0.8, 1.4), size: 0.45, toneMapped: false })));
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
