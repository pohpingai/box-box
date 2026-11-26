// three/city-layout.js — WHERE the city's buildings and trees go (pure maths,
// no 3D, so it can be checked in Node). The 3D part is in city.js.
//
// Placed like a film set, where the TV cameras look (not filling the infield):
//   1. Backdrops: a few buildings BEHIND each trackside camera's corner (seen
//      from that camera), tall ones in the middle, so every corner shot has a skyline.
//   2. Along the straights: buildings lining both sides of the road, set back
//      from it, so the chase camera drives down a street of lit towers.
//   3. About 60 trees round the buildings.
//   4. Light posts at even spacing along both road edges.
// Rules: nothing (except the posts) within 40 m of the track; nothing on the
// landmarks; a clear ring round the twisted tower so it stays the star; nothing
// between a trackside camera and its corner.
// Kit pieces at 1.5x (tall towers 30–45 units; the twisted tower is 63 and stays the tallest).
// The layout comes from a fixed seed, so it's the same on every visit.
// (Its own random numbers: the race is untouched.)
import { makeRng } from "../race.js";
import { camSpots } from "./camspots.js";

export const KIT_SCALE = 1.5;
export const CLEAR = 4;         // keep 4 units (40 m) between buildings/trees and the track's centre line
const PLATFORM = 0.8;           // round platforms drawn at 0.8x the building's size, so neighbours can stand close
const POST_EVERY = 12;          // a light post every 12 track points (6 units = 60 m)
const POST_SIDE = 2.1;          // posts stand 2.1 units from the centre line (just off the road edge)
const TREES = 60;
const TOWER_RING = 14;          // no tall buildings this close to the twisted tower's edge
const DOME_RING = 12;           // ...or to the dome's edge (so the helicopter and overview can see it)

// In Blender units: the round platform's radius, and the building's own
// footprint (half its diagonal — buildings must not touch each other).
const PLAT = { Kit_TallTower: 3.27, Kit_MediumBlock: 3.97, Kit_WideBlock: 5.77, Kit_CurvyBuilding: 5.97, Kit_Tree: 0.65 };
const BODY = { Kit_TallTower: 1.75, Kit_MediumBlock: 3.3, Kit_WideBlock: 5.0, Kit_CurvyBuilding: 6.0, Kit_Tree: 0.65 };

// Each piece: { kind, x, z, turn, s (size), sy (extra height), ps (platform size), r (body radius) }
export function cityLayout(track) {
  const rng = makeRng("vegas-kit");
  const P = track.points, n = P.length, spots = track.landmarkSpots, cams = camSpots(track);
  const [dome, tower] = spots;
  const placed = [];

  const trackDist = (x, z) => {
    let d = Infinity;
    for (const p of P) d = Math.min(d, (p.x - x) ** 2 + (p.z - z) ** 2);
    return Math.sqrt(d);
  };
  // Distance from (x, z) to the line from a camera to its corner.
  const toSightLine = (c, x, z) => {
    const ax = c.cam.x, az = c.cam.z, bx = c.apex.x, bz = c.apex.z;
    const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2)));
    return Math.hypot(x - (ax + (bx - ax) * t), z - (az + (bz - az) * t));
  };
  const fits = (kind, x, z, s, gap = 0.6) => {
    const ps = kind === "Kit_Tree" ? s : s * PLATFORM;
    const r = BODY[kind] * s, edge = PLAT[kind] * ps;
    if (trackDist(x, z) - edge < CLEAR) return false;
    if (spots.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + edge)) return false;
    if (kind !== "Kit_Tree" && Math.hypot(tower.x - x, tower.z - z) < tower.r + TOWER_RING + edge) return false;
    if (kind === "Kit_TallTower" && Math.hypot(dome.x - x, dome.z - z) < dome.r + DOME_RING + edge) return false;
    if (cams.some((c) => toSightLine(c, x, z) < edge + 2.5)) return false;
    return !placed.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + r + gap);
  };
  const add = (kind, x, z, s, sy = 1) => {
    const p = { kind, x, z, turn: rng() * Math.PI * 2, s, sy, ps: kind === "Kit_Tree" ? s : s * PLATFORM, r: BODY[kind] * s };
    placed.push(p);
    return p;
  };
  const tryAdd = (kind, x, z, s, sy, gap) => (fits(kind, x, z, s, gap) ? add(kind, x, z, s, sy) : null);
  const building = () => {
    const k = rng();
    return k < 0.25 ? "Kit_TallTower" : k < 0.75 ? "Kit_MediumBlock" : k < 0.88 ? "Kit_WideBlock" : "Kit_CurvyBuilding";
  };

  // 1) Backdrops behind each trackside corner: up to 7 buildings in a fan
  //    10–34 units beyond the apex, as seen from that corner's camera.
  for (const c of cams) {
    const dx = c.apex.x - c.cam.x, dz = c.apex.z - c.cam.z, l = Math.hypot(dx, dz);
    const fx = dx / l, fz = dz / l, sx = -fz, sz = fx;
    for (let tries = 0, made = 0; tries < 400 && made < 7; tries++) {
      const d = 10 + rng() * 24, side = (rng() - 0.5) * d * 1.1;
      const kind = d > 22 && Math.abs(side) < 6 && rng() < 0.6 ? "Kit_TallTower" : building();
      if (tryAdd(kind, c.apex.x + fx * d + sx * side, c.apex.z + fz * d + sz * side, KIT_SCALE * (0.9 + rng() * 0.2), 0.8 + rng() * 0.4, 0.8)) made++;
    }
  }

  // 2) Along the straights: both sides of the road, every ~11 units, set back from it.
  const bend = (i) => {
    const a = P[(i - 16 + n) % n], b = P[(i + 16) % n];
    let d = Math.atan2(b.dz, b.dx) - Math.atan2(a.dz, a.dx);
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return Math.abs(d);
  };
  for (let i = 0; i < n; i += 22) {
    if (bend(i) > 0.15) continue;
    for (const side of [-1, 1]) {
      if (rng() > 0.7) continue;
      const kind = building(), s = KIT_SCALE * (0.85 + rng() * 0.25);
      const off = CLEAR + PLAT[kind] * s * PLATFORM + 0.5 + rng() * 5;
      const p = P[i];
      tryAdd(kind, p.x + p.nx * off * side, p.z + p.nz * off * side, s, 0.8 + rng() * 0.4, 0.8);
    }
  }

  // 3) About 60 trees, round the buildings.
  const buildings = placed.slice();
  for (let tries = 0, made = 0; tries < 6000 && made < TREES; tries++) {
    const b = buildings[Math.floor(rng() * buildings.length)];
    const a = rng() * Math.PI * 2, d = PLAT[b.kind] * b.ps + 0.8 + rng() * 2.5;
    if (tryAdd("Kit_Tree", b.x + Math.cos(a) * d, b.z + Math.sin(a) * d, 1.2 + rng() * 0.5, 1, 0.4)) made++;
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

// For checks: the round platform's (or tree's) radius of a placed piece.
export const edgeOf = (p) => (PLAT[p.kind] ?? 0) * p.ps;
