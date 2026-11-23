// ui-replay.js — remembers what the race looked like after every lap,
// so the lap slider can show any moment again once the race is over.

import { RULES, standings } from "./race.js";

// One "frame" = everything the screen needs to draw one moment.
export function frameOf(race) {
  const lap = race.lap, s = race.surprises;
  const on = (w) => !!w && lap >= w.start && lap <= w.end;
  return {
    lap,
    safetyCar: on(s.safetyCar),
    rain: on(s.rain),
    // Each team's call for this lap (shown on the tags above the 3D cars).
    calls: Object.fromEntries(race.events.filter((e) => e.lap === lap).map((e) => [e.team, e.call])),
    cars: standings(race).map(({ team, compound, tyre, mode, time, stops }) => ({ team, compound, tyre, mode, time, stops })),
  };
}

// The picture before any race has run.
export function emptyFrame() {
  return {
    lap: 0, safetyCar: false, rain: false, calls: {},
    cars: ["A", "B"].map((team) => ({ team, compound: RULES.startCompound[team], tyre: 100, mode: "normal", time: 0, stops: 0 })),
  };
}

// frames[lap] = the race after that lap (frames[0] = the start).
export function makeReplay() {
  const frames = [];
  return {
    record(race) { frames[race.lap] = frameOf(race); },
    frame(lap) { return frames[lap]; },
    lastLap: () => frames.length - 1,
  };
}
