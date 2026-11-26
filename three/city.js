// three/city.js — the city, built from the owner's Blender kit (models/kit.glb):
// tall towers, medium blocks, wide blocks, curvy buildings, trees and light posts.
// WHERE each piece goes is worked out in city-layout.js (placed like a film set,
// where the TV cameras look). This file loads the kit and draws the pieces.
//
// Fast on phones: every kit part is drawn as ONE "instanced" mesh — the
// computer draws all the towers in one go instead of one by one.
import * as THREE from "../vendor/three/three.module.min.js";
import { GLTFLoader } from "../vendor/three/addons/loaders/GLTFLoader.js";
import { cityLayout } from "./city-layout.js";

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
