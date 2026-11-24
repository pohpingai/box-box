// three/city.js — the city, built from the owner's Blender kit (models/kit.glb):
// tall towers, medium blocks, wide blocks, curvy buildings, trees and light posts.
//
//   - Downtown: a dense cluster of tall + medium buildings behind the dome
//     (round the twisted tower and in the band north of it), each a little
//     taller or shorter (height × 0.8–1.4) and turned a different way.
//   - Islands: wide + curvy buildings on their own round platforms round the
//     infield, with trees round them.
//   - Fill: the leftover ground gets small blocks and trees, so little bare floor shows.
//   - Light posts at even spacing along both edges of the track.
//   - Nothing (except the posts) closer than 40 m to the track.
//
// Fast on phones: every kit piece is drawn as ONE "instanced" mesh — the
// computer draws all the towers in one go instead of one by one.
// The layout comes from a fixed seed, so the city looks the same on every
// visit. (Its own random numbers: the race is untouched.)
import * as THREE from "../vendor/three/three.module.min.js";
import { GLTFLoader } from "../vendor/three/addons/loaders/GLTFLoader.js";
import { makeRng } from "../race.js";

export const KIT_SCALE = 2;     // kit pieces shown 2x their Blender size: downtown becomes a real skyline
export const CLEAR = 4;         // keep 4 units (40 m) between buildings/trees and the track's centre line
const POST_EVERY = 12;          // a light post every 12 track points (6 units = 60 m)
const POST_SIDE = 2.1;          // posts stand 2.1 units from the centre line (just off the road edge)
const PLATFORM = 0.8;           // round platforms drawn at 0.8x the building's size, so neighbours can stand close

// In Blender units: the round platform's radius, and the building's own
// footprint (half its diagonal — buildings must not touch each other).
const PLAT = { Kit_TallTower: 3.27, Kit_MediumBlock: 3.97, Kit_WideBlock: 5.77, Kit_CurvyBuilding: 5.97, Kit_Tree: 0.65 };
const BODY = { Kit_TallTower: 1.75, Kit_MediumBlock: 3.3, Kit_WideBlock: 5.0, Kit_CurvyBuilding: 6.0, Kit_Tree: 0.65 };

// ---------- Where everything goes (pure maths, no 3D: tested in Node) ----------
// Each piece: { kind, x, z, turn, s (size), sy (extra height), ps (platform size), r (body radius) }
export function cityLayout(track) {
  const rng = makeRng("vegas-kit");
  const P = track.points, spots = track.landmarkSpots;
  const placed = [];

  const trackDist = (x, z) => {
    let d = Infinity;
    for (const p of P) d = Math.min(d, (p.x - x) ** 2 + (p.z - z) ** 2);
    return Math.sqrt(d);
  };
  // Does a piece fit at (x, z)? Inside the loop, its platform edge 40 m off the
  // track, off the landmarks, and its body not touching another body.
  const fits = (kind, x, z, s, gap = 0.5) => {
    const ps = kind === "Kit_Tree" ? s : s * PLATFORM;
    const r = BODY[kind] * s, edge = PLAT[kind] * ps;
    return insideLoop(P, x, z) && trackDist(x, z) - edge >= CLEAR &&
      !spots.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + edge) &&
      !placed.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + r + gap);
  };
  const add = (kind, x, z, s, sy = 1) => {
    const p = { kind, x, z, turn: rng() * Math.PI * 2, s, sy, ps: kind === "Kit_Tree" ? s : s * PLATFORM, r: BODY[kind] * s };
    placed.push(p);
    return p;
  };
  const tryAdd = (kind, x, z, s, sy, gap) => (fits(kind, x, z, s, gap) ? add(kind, x, z, s, sy) : null);

  const [dome, tower, wheel] = spots;
  // 1) Downtown first, so it gets the room it needs: behind the dome, round the
  //    twisted tower and in the band north of it (never in front of the tower). Tall towers in the middle,
  //    medium blocks round the edge, each 0.8–1.4x as tall, turned any way.
  const centre = { x: tower.x, z: tower.z - 12 };
  const room = { ...tower, r: tower.r + 6 }; // a clear ring round the twisted tower, so it isn't hidden
  let tall = 0;
  for (let tries = 0; tries < 8000; tries++) {
    const x = centre.x + (rng() - 0.5) * 80, z = centre.z + (rng() - 0.5) * 60;
    if (z > tower.z + 4) continue; // stay behind the dome AND the tower, so neither gets hidden
    const middle = Math.hypot((x - centre.x) / 40, (z - centre.z) / 30) < 0.55;
    let kind = rng() < (middle ? 0.6 : 0.3) ? "Kit_TallTower" : "Kit_MediumBlock";
    if (kind === "Kit_TallTower" && tall >= 12) kind = "Kit_MediumBlock"; // at most 12 skyscrapers
    if (Math.hypot(room.x - x, room.z - z) < room.r + BODY[kind] * KIT_SCALE) continue;
    if (tryAdd(kind, x, z, KIT_SCALE * (0.85 + rng() * 0.15), 0.8 + rng() * 0.6, 0.6) && kind === "Kit_TallTower") tall++;
  }

  // 2) Islands: wide and curvy buildings anywhere else in the infield, with trees round each.
  const islands = [];
  for (let tries = 0; tries < 8000; tries++) {
    const kind = rng() < 0.5 ? "Kit_WideBlock" : "Kit_CurvyBuilding";
    const x = (rng() - 0.5) * 120, z = (rng() - 0.5) * 200;
    const isl = tryAdd(kind, x, z, KIT_SCALE * (0.8 + rng() * 0.2), 0.9 + rng() * 0.3, 3);
    if (isl) islands.push(isl);
  }
  for (const isl of islands) {
    for (let tries = 0; tries < 80; tries++) {
      const a = rng() * Math.PI * 2, d = PLAT[isl.kind] * isl.ps + 0.6 + rng() * 3;
      tryAdd("Kit_Tree", isl.x + Math.cos(a) * d, isl.z + Math.sin(a) * d, 1.6 + rng() * 0.8, 1, 0.3);
    }
  }

  // 3) Fill the rest of the infield so little bare floor shows: on a tight grid,
  //    a medium block where there's room, otherwise a tree.
  for (let x = -60; x <= 60; x += 2.2) {
    for (let z = -100; z <= 100; z += 2.2) {
      const jx = x + (rng() - 0.5) * 1.6, jz = z + (rng() - 0.5) * 1.6;
      // (no blocks in the corridor between the dome and the tower: only trees, so the view to the tower stays open)
      const corridor = jz < dome.z && jz > tower.z && Math.abs(jx - tower.x) < 28;
      if (!corridor && rng() < 0.25) tryAdd("Kit_MediumBlock", jx, jz, KIT_SCALE * (0.7 + rng() * 0.2), 0.5 + rng() * 0.5, 1);
      tryAdd("Kit_Tree", jx, jz, 1.6 + rng() * 0.8, 1, 0.4);
    }
  }

  // 4) Light posts on both road edges, evenly spaced (the only things near the track).
  P.forEach((p, i) => {
    if (i % POST_EVERY) return;
    for (const side of [-1, 1]) {
      placed.push({ kind: "Kit_LightPost", x: p.x + p.nx * POST_SIDE * side, z: p.z + p.nz * POST_SIDE * side, turn: 0, s: 0.6, sy: 1, ps: 0.6, r: 0 });
    }
  });
  return placed;
}

// ---------- The 3D part ----------
// Glow levels (Blender's 3–5 bleach to white under the bloom, as with the landmarks).
const GLOW = { HD_Gold_Edge: 1.1, HD_Gold_Rim: 1.0, HD_Gold_Joint: 1.6, HT_Edge_Purple: 1.4, KIT_Window: 0.5 };

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
  // Glass: fairly solid and glowing, so each face reads as a lit purple panel (not hatching).
  if (m.name === "KIT_Glass") { m.opacity = 0.5; m.emissiveIntensity = 1.5; }
  if (m.transparent) m.depthWrite = false;
  const mesh = new THREE.InstancedMesh(part.geometry, m, items.length);
  const mat = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  items.forEach((p, i) => {
    q.setFromAxisAngle(up, p.turn);
    // Platforms use their own (smaller) size and stay flat; the building gets its height.
    const k = /Platform/.test(part.name) ? p.ps : p.s, ky = /Platform/.test(part.name) ? p.ps : p.s * p.sy;
    mat.compose(new THREE.Vector3(p.x, 0, p.z), q, new THREE.Vector3(k, ky, k));
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
