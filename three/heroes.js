// three/heroes.js — the three "hero" landmarks made in Blender (models/heroes.glb):
// a geodesic dome, a twisted tower and a Ferris wheel, glowing gold and purple.
//
// Inside the file they stand in a row: dome at 0, tower 25 units along, wheel
// 50 units along (1 unit = 10 metres, same as the 3D view). We keep that row
// exactly as made and only pick it up and set it down as one piece:
//   - the dome sits in the middle of the infield (the camera circles the middle
//     and always looks at it, so that is the most visible spot),
//   - the row points north-north-west, so from the opening camera view the tower
//     rises just behind the dome and the wheel stands off to its side.
// Every part keeps at least 80 m (8 units) of space to the track's centre line
// (checked against exports/track.json).
import * as THREE from "../vendor/three/three.module.min.js";
import { GLTFLoader } from "../vendor/three/addons/loaders/GLTFLoader.js";

export const HERO_PLACE = { x: 0, z: 0, turn: (110 * Math.PI) / 180 }; // turn = around the up axis

// Each hero's spot in the file (distance along the row) and how much room it
// needs round it (its platform's radius) — the city keeps its buildings out.
const ROW = [{ along: 0, r: 15.3 }, { along: 25, r: 6.3 }, { along: 50, r: 8.6 }];

// Where the heroes stand on the map, so the city can keep clear of them.
export function heroSpots() {
  const { x, z, turn } = HERO_PLACE;
  return ROW.map(({ along, r }) => ({ x: x + along * Math.cos(turn), z: z - along * Math.sin(turn), r: r + 3 }));
}

// Glow levels. Blender's settings are very bright (strength 3–5). Too bright and
// the tone mapping + bloom bleach gold and purple to white, so we turn them down
// to a level where they still glow but keep their colour.
const GLOW = { HD_Gold_Edge: 1.1, HD_Gold_Rim: 1.1, HD_Gold_Joint: 1.5, HT_Edge_Purple: 1.4 };

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
      if (m.transparent) m.depthWrite = false; // see-through glass shouldn't hide the lines behind it
    });
    group.add(gltf.scene);
    return group;
  }).catch((e) => {
    console.warn("Landmarks (heroes.glb) didn't load:", e);
    return null;
  });
  group.userData.ready = ready;
  return group;
}
