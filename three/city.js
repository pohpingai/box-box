// three/city.js — the city, built from the owner's Blender kit (models/kit.glb):
// tall towers, medium blocks, wide blocks, curvy buildings, trees and light posts.
//
//   - Downtown: a dense cluster of tall + medium buildings behind the dome
//     (round the twisted tower and in the band north of it), each a little
//     taller or shorter (height × 0.8–1.4) and turned a different way.
//   - Islands: wide + curvy buildings standing on their own round platforms
//     near the landmarks, with trees round them.
//   - Light posts at even spacing along both edges of the track.
//   - Nothing (except the posts) closer than 40 m to the track.
//
// Fast on phones: every kit piece is drawn as ONE "instanced" mesh — the
// computer draws all 20 towers in one go instead of 20 times.
// The layout comes from a fixed seed, so the city looks the same on every
// visit. (Its own random numbers: the race is untouched.)
import * as THREE from "../vendor/three/three.module.min.js";
import { GLTFLoader } from "../vendor/three/addons/loaders/GLTFLoader.js";
import { makeRng } from "../race.js";

export const KIT_SCALE = 1.3;   // kit pieces shown 1.3x their Blender size (the landmarks are 2x)
export const CLEAR = 4;         // keep 4 units (40 m) between buildings/trees and the track's centre line
const POST_EVERY = 12;          // a light post every 12 track points (6 units = 60 m)
const POST_SIDE = 2.1;          // posts stand 2.1 units from the centre line (just off the road edge)

// How much ground each piece covers (its round platform, or the tree's crown), in Blender units.
const FOOT = { Kit_TallTower: 3.27, Kit_MediumBlock: 3.97, Kit_WideBlock: 5.77, Kit_CurvyBuilding: 5.97, Kit_Tree: 0.65 };

// ---------- Where everything goes (pure maths, no 3D: tested in Node) ----------
export function cityLayout(track) {
  const rng = makeRng("vegas-kit");
  const P = track.points, spots = track.landmarkSpots;
  const placed = []; // { kind, x, z, turn, s, sy, r }

  const trackDist = (x, z) => {
    let d = Infinity;
    for (const p of P) d = Math.min(d, (p.x - x) ** 2 + (p.z - z) ** 2);
    return Math.sqrt(d);
  };
  // Does a circle of radius r at (x, z) fit? Inside the loop, 40 m off the track,
  // off the landmarks, and not on top of another piece (`gap` = how close they may get).
  const fits = (x, z, r, gap = 0.6) =>
    insideLoop(P, x, z) && trackDist(x, z) - r >= CLEAR &&
    !spots.some((s) => Math.hypot(s.x - x, s.z - z) < s.r + r) &&
    !placed.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + r + gap);
  const add = (kind, x, z, s, sy = 1) => {
    const p = { kind, x, z, turn: rng() * Math.PI * 2, s, sy, r: FOOT[kind] * s };
    placed.push(p);
    return p;
  };

  const [dome, tower, wheel] = spots;
  // 1) Downtown (first, so it gets the room it needs): behind the dome — round the twisted tower and the band north of it.
  //    Tall towers in the middle of the cluster, medium blocks round the edge.
  const centre = { x: tower.x, z: tower.z - 14 };
  let built = 0;
  for (let tries = 0; tries < 6000 && built < 26; tries++) {
    const x = centre.x + (rng() - 0.5) * 70, z = centre.z + (rng() - 0.5) * 50;
    if (z > dome.z - dome.r) continue; // stay behind the dome
    const middle = Math.hypot((x - centre.x) / 35, (z - centre.z) / 25) < 0.55;
    const kind = rng() < (middle ? 0.6 : 0.3) ? "Kit_TallTower" : "Kit_MediumBlock";
    const s = KIT_SCALE * (0.72 + rng() * 0.2);
    if (fits(x, z, FOOT[kind] * s, -0.4)) { add(kind, x, z, s, 0.8 + rng() * 0.6); built++; }
  }
  // A few trees tucked into downtown's gaps.
  for (let n = 0, tries = 0; n < 18 && tries < 3000; tries++) {
    const x = centre.x + (rng() - 0.5) * 80, z = centre.z + (rng() - 0.5) * 60, s = 1 + rng() * 0.5;
    if (z < dome.z - dome.r && fits(x, z, FOOT.Kit_Tree * s, 0.3)) { add("Kit_Tree", x, z, s); n++; }
  }

  // 2) Islands: wide and curvy buildings near the landmarks, with trees round each.
  const islands = [];
  for (let tries = 0; tries < 4000 && islands.length < 6; tries++) {
    const kind = islands.length % 2 ? "Kit_WideBlock" : "Kit_CurvyBuilding";
    const near = [dome, wheel, tower][islands.length % 3];
    const a = rng() * Math.PI * 2, d = near.r + 3 + rng() * 40;
    const x = near.x + Math.cos(a) * d, z = near.z + Math.sin(a) * d;
    if (fits(x, z, FOOT[kind] * KIT_SCALE * 0.85, 2)) islands.push(add(kind, x, z, KIT_SCALE * 0.85));
  }
  for (const isl of islands) {
    for (let n = 0, tries = 0; n < 6 && tries < 60; tries++) {
      const a = rng() * Math.PI * 2, d = isl.r + 0.8 + rng() * 3;
      const x = isl.x + Math.cos(a) * d, z = isl.z + Math.sin(a) * d, s = 1.1 + rng() * 0.5;
      if (fits(x, z, FOOT.Kit_Tree * s, 0.2)) { add("Kit_Tree", x, z, s); n++; }
    }
  }

  // 3) Light posts on both road edges, evenly spaced (the only things near the track).
  P.forEach((p, i) => {
    if (i % POST_EVERY) return;
    for (const side of [-1, 1]) {
      placed.push({ kind: "Kit_LightPost", x: p.x + p.nx * POST_SIDE * side, z: p.z + p.nz * POST_SIDE * side, turn: 0, s: 0.6, sy: 1, r: 0 });
    }
  });
  return placed;
}

// ---------- The 3D part ----------
// Glow levels (Blender's 3–5 bleach to white under the bloom, as with the landmarks).
const GLOW = { HD_Gold_Edge: 1.1, HD_Gold_Rim: 1.0, HD_Gold_Joint: 1.6, HT_Edge_Purple: 1.4, KIT_Window: 0.8 };

export function makeCity(track) {
  const group = new THREE.Group();
  group.name = "city";
  const layout = cityLayout(track);
  const url = new URL("../models/kit.glb", import.meta.url).href;
  group.userData.ready = new GLTFLoader().loadAsync(url).then((gltf) => {
    for (const kit of gltf.scene.children) {
      const items = layout.filter((p) => p.kind === kit.name);
      if (!items.length) continue;
      // Each kit piece sits at its own spot in the Blender file: use it as if at 0,0,0.
      kit.position.set(0, 0, 0);
      kit.updateMatrixWorld(true);
      kit.traverse((part) => {
        if (part.isMesh) group.add(instanced(part, items));
      });
    }
    return group;
  }).catch((e) => {
    console.warn("City kit (kit.glb) didn't load:", e);
    return null;
  });
  return group;
}

// One kit part (e.g. "tall tower's glass") drawn at every spot in `items` at once.
function instanced(part, items) {
  const m = part.material;
  if (GLOW[m.name] !== undefined) m.emissiveIntensity = GLOW[m.name];
  if (m.name === "KIT_Glass") m.opacity = 0.3; // see-through enough that the purple lines show
  if (m.transparent) m.depthWrite = false;
  const mesh = new THREE.InstancedMesh(part.geometry, m, items.length);
  const mat = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  items.forEach((p, i) => {
    q.setFromAxisAngle(up, p.turn);
    mat.compose(new THREE.Vector3(p.x, 0, p.z), q, new THREE.Vector3(p.s, p.s * p.sy, p.s));
    mesh.setMatrixAt(i, mat.multiply(part.matrixWorld)); // part's own offset inside the kit piece
  });
  mesh.computeBoundingSphere();
  return mesh;
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
