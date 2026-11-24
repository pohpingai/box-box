// three/heroes.js — the three "hero" landmarks made in Blender (models/heroes.glb):
// a geodesic dome, a twisted tower and a Ferris wheel, glowing gold and purple.
//
// Inside the file they stand in a row: dome at 0, tower 25 units along, wheel
// 50 units along (1 unit = 10 metres, same as the 3D view). We keep that row
// exactly as made and only pick it up and set it down as one piece:
//   - everything is shown at 2x the Blender size, so the landmarks stand out
//     above the city instead of getting lost in it,
//   - at that size only the wide southern half of the infield has room, so the
//     dome sits there (the side nearest the opening camera), and the row points
//     north: the tower rises behind the dome, near the middle of the infield,
//     and the wheel stands beyond it, off to the left of the opening view.
// Every part keeps at least 80 m (8 units) of space to the track's centre line
// (checked against exports/track.json).
import * as THREE from "../vendor/three/three.module.min.js";
import { GLTFLoader } from "../vendor/three/addons/loaders/GLTFLoader.js";

export const HERO_PLACE = { x: -17, z: 55, turn: Math.PI / 2, size: 2 }; // turn = around the up axis

// Each hero's spot in the file (distance along the row) and how much room it
// needs round it (its platform's radius) — the city keeps its buildings out.
const ROW = [{ along: 0, r: 15.3 }, { along: 25, r: 6.3 }, { along: 50, r: 8.6 }];

// Where the heroes stand on the map, so the city can keep clear of them.
export function heroSpots() {
  const { x, z, turn, size } = HERO_PLACE;
  return ROW.map(({ along, r }) => ({
    x: x + along * size * Math.cos(turn), z: z - along * size * Math.sin(turn), r: r * size + 3,
  }));
}

// The point the camera circles and looks at: halfway along the row (near the
// tower), a little above the ground, nudged towards the dome so it stays in shot.
export function heroCentre() {
  const [dome, tower] = heroSpots();
  return new THREE.Vector3((dome.x + tower.x) / 2, 18, (dome.z * 0.4 + tower.z * 0.6));
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
  group.scale.setScalar(HERO_PLACE.size);
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
