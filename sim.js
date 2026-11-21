// sim.js — the strategist's "what if?" tool.
// simulate(state, plan) → how the race would end if we follow `plan` from now.
//
// It only uses what the team can see (its own lap view, `state`), never the
// real race's seed, so it can't peek at future safety cars, rain or slow stops.
// Assumptions (also told to the AI):
//   - from the next lap on: no safety car, no rain, no slow stops, no luck;
//   - the rival drives like the rule bot;
//   - after the plan's steps, our car follows the rule bot.
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

// A plan = { now, box_on_lap?, box_tyre? }, e.g.
//   { now: "box_hard" }                                   "box_hard now"
//   { now: "stay_out", box_on_lap: 12, box_tyre: "medium" } "stay_out, box_medium on lap 12"
// Until the planned stop our car only changes driving mode (rule bot), never pits;
// on that lap it pits; after the plan, the rule bot drives.
export function checkPlan(state, plan) {
  const first = TO_ENGINE[plan?.now];
  if (!first) throw new Error(`unknown call "${plan?.now}"`);
  const lapNum = plan.box_on_lap;
  if (lapNum === undefined || lapNum === null) return { first, boxLap: null, boxCall: null };
  if (!Number.isInteger(lapNum) || lapNum <= state.lap || lapNum > RULES.laps) {
    throw new Error(`box_on_lap must be a lap after ${state.lap} and at most ${RULES.laps}`);
  }
  if (!COMPOUNDS[plan.box_tyre]) throw new Error("box_tyre must be soft, medium or hard");
  if (first.startsWith("BOX_")) throw new Error("plan has two stops: keep it to one pit stop per plan");
  return { first, boxLap: lapNum, boxCall: `BOX_${plan.box_tyre.toUpperCase()}` };
}

export function planLabel(plan) {
  const now = plan.now.startsWith("box_") ? `${plan.now} now` : plan.now;
  return plan.box_on_lap ? `${now}, box_${plan.box_tyre} on lap ${plan.box_on_lap}` : now;
}

export function simulate(state, plan) {
  checkState(state);
  const { first, boxLap, boxCall } = checkPlan(state, plan);
  const lap = state.lap - 1; // laps already done
  const car = (v, time) => ({ compound: v.compound, tyre: v.tyre, mode: v.mode, stops: v.stops, time, lastLap: 0 });
  // Our car: the plan first, then the rule bot.
  const ours = (t, s) => {
    if (s.lap === state.lap) return { call: first, reason: "plan" };
    if (boxLap && s.lap === boxLap) return { call: boxCall, reason: "plan" };
    const b = bot.decide(t, s);
    // Before the planned stop: no surprise extra stops.
    if (boxLap && s.lap < boxLap && b.call.startsWith("BOX_")) return { call: "STAY", reason: "plan" };
    return b;
  };
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
    deciders: { A: ours, B: bot.decide },
  };
  while (!race.done) stepLap(race);
  const gap = +(race.cars.A.time - race.cars.B.time).toFixed(2);
  return {
    plan: planLabel(plan),
    finishGap: gap, // negative = we finish ahead
    predicted: gap <= 0 ? `finish P1, ${Math.abs(gap).toFixed(2)}s AHEAD of the rival`
                        : `finish P2, ${gap.toFixed(2)}s BEHIND the rival`,
    ourStops: race.cars.A.stops,
  };
}
