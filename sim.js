// sim.js — the strategist's "what if?" tool.
// simulate(state, call) → how the race would end if we make `call` now.
//
// It only uses what the team can see (its own lap view, `state`), never the
// real race's seed, so it can't peek at future safety cars, rain or slow stops.
// Assumptions (also told to the AI):
//   - from the next lap on: no safety car, no rain, no slow stops, no luck;
//   - the rival drives like the rule bot;
//   - after this lap, our car also follows the rule bot's plan.
// It reuses the real race engine, so the maths is identical to the race.

import { RULES, COMPOUNDS, MODES, stepLap } from "./race.js";
import * as bot from "./agents/bot.js";

// AI words → engine codes.
export const TO_ENGINE = {
  stay_out: "STAY", push: "PUSH", normal: "NORMAL", save: "SAVE",
  box_soft: "BOX_SOFT", box_medium: "BOX_MEDIUM", box_hard: "BOX_HARD",
};

// The state comes from the internet, so check it before running anything.
function checkState(s) {
  const okCar = (c) => c && COMPOUNDS[c.compound] && MODES[c.mode] &&
    Number.isFinite(c.tyre) && c.tyre >= 0 && c.tyre <= 100 && Number.isInteger(c.stops) && c.stops >= 0 && c.stops <= 20;
  if (!s || !Number.isInteger(s.lap) || s.lap < 1 || s.lap > RULES.laps) throw new Error("bad lap number");
  if (!Number.isFinite(s.gapToRival) || Math.abs(s.gapToRival) > 10000) throw new Error("bad gap");
  if (!okCar(s.me) || !okCar(s.rival)) throw new Error("bad car data");
}

export function simulate(state, aiCall) {
  const first = TO_ENGINE[aiCall];
  if (!first) throw new Error(`unknown call "${aiCall}"`);
  checkState(state);
  const lap = state.lap - 1; // laps already done
  const car = (v, time) => ({ compound: v.compound, tyre: v.tyre, mode: v.mode, stops: v.stops, time, lastLap: 0 });
  // In the sim, "A" = us and "B" = the rival. Times: rival at 0, us at the gap.
  const race = {
    seed: "sim",
    lap,
    // Only what's happening right now; the future is assumed clear.
    surprises: {
      safetyCar: state.safetyCar ? { start: state.lap, end: state.lap } : null,
      rain: state.rain ? { start: state.lap, end: state.lap } : null,
    },
    cars: { A: { team: "A", ...car(state.me, state.gapToRival) }, B: { team: "B", ...car(state.rival, 0) } },
    events: [], news: [], done: false,
    rng: () => 0.5, // no luck: zero lap-time noise and never a slow stop
    deciders: {
      A: (t, s) => (s.lap === state.lap ? { call: first, reason: "tested call" } : bot.decide(t, s)),
      B: bot.decide,
    },
  };
  while (!race.done) stepLap(race);
  const gap = +(race.cars.A.time - race.cars.B.time).toFixed(2);
  return {
    call: aiCall,
    finishGap: gap, // negative = we finish ahead
    predicted: gap <= 0 ? `finish P1, ${Math.abs(gap).toFixed(2)}s AHEAD of the rival`
                        : `finish P2, ${gap.toFixed(2)}s BEHIND the rival`,
    ourStops: race.cars.A.stops,
  };
}
