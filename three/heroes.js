// three/heroes.js — the three "hero" landmarks made in Blender (models/heroes.glb):
// a geodesic dome, a twisted tower and a Ferris wheel, glowing gold and purple.
//
// Inside the file they stand in a row: dome at 0, tower 25 units along, wheel
// 50 units along (1 unit = 10 metres, same as the 3D view). We keep that row
// exactly as made and only pick it up and set it down as one piece:
//   - each landmark has its own size (see PARTS): dome 1.3x, tower 1.5x tall,
//     wheel 2x, and the gaps between them are stretched 2x,
//   - at that size only the wide southern half of the infield has room, so the
//     dome sits there (the side nearest the opening camera), and the row points
//     north: the tower rises behind the dome, near the middle of the infield,
//     and the wheel stands beyond it, off to the left of the opening view.
// Every part keeps at least 80 m (8 units) of space to the track's centre line
// (checked against exports/track.json).
import * as THREE from "../vendor/three/three.module.min.js";
import { GLTFLoader } from "../vendor/three/addons/loaders/GLTFLoader.js";

export const HERO_PLACE = { x: -17, z: 55, turn: Math.PI / 2, spacing: 2 }; // turn = around the up axis;
// spacing = the row's gaps are stretched 2x (dome → tower 50 units, tower → wheel 50 units)

// Each landmark's own size (x = across, y = height, z = depth), its spot along
// the row in the Blender file, and how much room it needs (its platform's radius
// in Blender units) — the city keeps its buildings out of that circle.
//   dome 1.3x, tower 1.3x wide but 1.5x tall (so the downtown skyline nearly
//   reaches it), Ferris wheel 2x.
const PARTS = {
  Dome: { along: 0, size: [1.3, 1.3, 1.3], r: 15.3 },
  Platform: { along: 0, size: [1.3, 1.3, 1.3], r: 15.3 }, // the dome's round base
  Tower: { along: 25, size: [1.3, 1.5, 1.3], r: 6.3 },
  Wheel: { along: 50, size: [2, 2, 2], r: 8.6 },
};
const ROW = [PARTS.Dome, PARTS.Tower, PARTS.Wheel];

// Where the heroes stand on the map, so the city can keep clear of them.
export function heroSpots() {
  const { x, z, turn, spacing } = HERO_PLACE;
  return ROW.map(({ along, size, r }) => ({
    x: x + along * spacing * Math.cos(turn), z: z - along * spacing * Math.sin(turn), r: r * size[0] + 3,
  }));
}

// Glow levels. Blender's settings are very bright (strength 3–5). Too bright and
// the tone mapping + bloom bleach gold and purple to white, so we turn them down
// to a level where they still glow but keep their colour.
const GLOW = { HD_Gold_Edge: 1.1, HD_Gold_Rim: 1.1, HD_Gold_Joint: 1.5, HT_Edge_Purple: 1.4 };

// How much brighter the twisted tower's parts glow than the rest (it's the star of the skyline).
const TOWER_GLOW = { HT_Edge_Purple: 2.2, HD_Gold_Edge: 1.8, HT_Glass: 2.5, HD_Gold_Rim: 1.3 };

// Loads the file and adds it to `parent`. If loading fails, the rest of the 3D
// view carries on without the heroes (and says so in the console).
export function addHeroes(parent) {
  const group = new THREE.Group();
  group.name = "heroes";
  group.position.set(HERO_PLACE.x, 0, HERO_PLACE.z);
  group.rotation.y = HERO_PLACE.turn;
  parent.add(group);

  const url = new URL("../models/heroes.glb", import.meta.url).href;
  const ready = new GLTFLoader().loadAsync(url).then((gltf) => {
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      const m = o.material;
      if (GLOW[m.name] !== undefined) m.emissiveIntensity = GLOW[m.name];
      // The tower's glass was nearly solid and hid its purple lines: make it
      // much clearer and dimmer, so it reads as a light tint behind the lines.
      if (m.name === "HT_Glass") { m.opacity = 0.12; m.emissiveIntensity = 0.4; }
      if (m.transparent) m.depthWrite = false; // see-through glass shouldn't hide the lines behind it
      // The twisted tower is the star: its own (brighter) copy of each material.
      if (o.name.startsWith("Tower_")) {
        o.material = m.clone();
        o.material.emissiveIntensity = (TOWER_GLOW[m.name] ?? 1) * o.material.emissiveIntensity;
        if (m.name === "HT_Glass") o.material.opacity = 0.22;
      }
    });
    // Give each landmark its own size, standing on its own spot along the row.
    group.userData.dome = [];
    for (const node of [...gltf.scene.children]) {
      const part = PARTS[node.name.split("_")[0]];
      if (!part) continue;
      node.position.set(part.along * HERO_PLACE.spacing, 0, 0);
      node.scale.set(...part.size);
      if (part.along === 0) group.userData.dome.push(node);
    }
    group.add(gltf.scene);
    return group;
  }).catch((e) => {
    console.warn("Landmarks (heroes.glb) didn't load:", e);
    return null;
  });
  group.userData.ready = ready;
  return group;
}
