// three/track3d.js — turns the real Vegas outline (longitude/latitude) into
// a loop of evenly spaced points on our 3D "ground" (1 unit = 10 metres).
// Same recipe as the mini game in f1-news: flat map → round the sharp corners → even spacing.

const UNIT = 10; // metres per 3D unit

// Longitude/latitude → x (east) and z (south), in units. Shared by the track
// and the landmarks, so the Sphere and the wheel sit where they really are.
// The middle of the map is the middle of the track's bounding box.
export function makeProjector(coords) {
  const lons = coords.map((c) => c[0]), lats = coords.map((c) => c[1]);
  const lon0 = (Math.min(...lons) + Math.max(...lons)) / 2, lat0 = (Math.min(...lats) + Math.max(...lats)) / 2;
  const k = Math.cos((lat0 * Math.PI) / 180);
  return ([lon, lat]) => ({ x: ((lon - lon0) * k * 111320) / UNIT, z: (-(lat - lat0) * 111320) / UNIT });
}

export function buildTrack(coords) {
  const project = makeProjector(coords);
  let pts = coords.map((c) => project(c));
  const first = pts[0], last = pts.at(-1);
  if (Math.hypot(first.x - last.x, first.z - last.z) < 0.1) pts.pop(); // closed loop: drop the repeat

  // Round the sharpest corners a little ("corner cutting", two passes).
  for (let pass = 0; pass < 2; pass++) {
    const out = [];
    pts.forEach((p, i) => {
      const q = pts[(i + 1) % pts.length];
      out.push(mix(p, q, 0.25), mix(p, q, 0.75));
    });
    pts = out;
  }

  // Evenly spaced points every half unit (5 metres).
  const step = 0.5, even = [];
  let carry = 0;
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length], len = Math.hypot(q.x - p.x, q.z - p.z);
    let t = carry;
    while (t < len) { even.push(mix(p, q, t / len)); t += step; }
    carry = t - len;
  });

  // Direction of travel at each point, and the "sideways" normal (for the ribbon edges).
  const n = even.length;
  even.forEach((p, i) => {
    const a = even[(i - 2 + n) % n], b = even[(i + 2) % n];
    const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
    p.dx = dx / l; p.dz = dz / l;
    p.nx = -p.dz; p.nz = p.dx;
  });

  // Where is a car that has done `s` of a lap (0 = start line, 0.5 = halfway)?
  function pointAt(s) {
    const f = (((s % 1) + 1) % 1) * n, i = Math.floor(f), u = f - i;
    const p = even[i], q = even[(i + 1) % n];
    return { x: p.x + (q.x - p.x) * u, z: p.z + (q.z - p.z) * u, dx: p.dx, dz: p.dz };
  }

  // Size of the track, so the camera knows how far back to stand.
  const xs = even.map((p) => p.x), zs = even.map((p) => p.z);
  const radius = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) / 2;

  return { points: even, pointAt, radius, project };
}

function mix(p, q, t) { return { x: p.x + (q.x - p.x) * t, z: p.z + (q.z - p.z) * t }; }
