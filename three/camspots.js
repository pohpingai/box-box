// three/camspots.js — where the trackside TV cameras stand.
//
// Like a real broadcast, the cameras are placed by hand at corners near the
// landmarks. Each stands on the OUTSIDE of its corner, a little above the
// ground, looking at the apex (the inside point of the bend). The city puts
// its buildings BEHIND each corner, so every trackside shot has a backdrop.
//
// "Turn" numbers: our own count of the track's bends in driving order from the
// start line (the real Las Vegas circuit officially has 17 turns; we count 12
// clear bends on our smoothed outline, so the numbers are close but not official).

// i = the track point at the apex (points are 0.5 units = 5 m apart).
const CORNERS = [
  { turn: 1, i: 28 },    // hairpin after the start, near the dome
  { turn: 3, i: 280 },   // between the twisted tower and the wheel
  { turn: 7, i: 511 },   // next to the Ferris wheel
  { turn: 10, i: 988 },  // end of the long straight, behind the dome
  { turn: 12, i: 1177 }, // the last bend before the start line, near the dome
];
const BACK = 13;   // how far outside the corner the camera stands (units, 1 = 10 m)
const HIGH = 4.5;  // camera height

export function camSpots(track) {
  const P = track.points, n = P.length;
  return CORNERS.map(({ turn, i }) => {
    const apex = P[i], a = P[(i - 16 + n) % n], b = P[(i + 16) % n];
    // "Inward" = from the apex towards the middle of the bend.
    let ix = (a.x + b.x) / 2 - apex.x, iz = (a.z + b.z) / 2 - apex.z;
    const l = Math.hypot(ix, iz) || 1;
    ix /= l; iz /= l;
    return {
      name: `TURN ${turn}`,
      at: i / n, // how far round the lap the corner is (0..1)
      apex: { x: apex.x, z: apex.z },
      cam: { x: apex.x - ix * BACK, y: HIGH, z: apex.z - iz * BACK },
      inward: { x: ix, z: iz },
    };
  });
}
