// exports/make-track-json.js — writes exports/track.json: the Las Vegas track
// centre line exactly as the 3D view draws it, as a list of [x, y, z] points.
// Uses the same code as the 3D view (three/track3d.js), so the two never drift apart.
// Units: 1 = 10 metres. x = east, z = south, y = up (the track is flat, so y = 0).
// Points are 5 metres apart, in driving order; point 0 is the start/finish line.
// Run it again after changing the track:  node exports/make-track-json.js
import { writeFileSync } from "node:fs";
import { VEGAS } from "../track/vegas.js";
import { buildTrack } from "../three/track3d.js";

const round = (v) => Math.round(v * 1000) / 1000;
const pts = buildTrack(VEGAS.coords).points.map((p) => [round(p.x), 0, round(p.z)]);
writeFileSync(new URL("./track.json", import.meta.url), JSON.stringify(pts) + "\n");
console.log(`track.json: ${pts.length} points`);
