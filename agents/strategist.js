// agents/strategist.js — the "AI strategist" brain.
// Since step 3 the AI can run simulate("box_hard") etc. in the Worker before
// deciding; the results come back as `sims` and are shown on the radio.
// Same shape as the rule bot: decide(team, state) → { call, reason },
// except it takes a moment to answer (it returns a Promise), because it asks
// an AI model over the internet via our Worker (box-box-brain).
//
// Safety net: if the AI is too slow (over 8s), breaks, or answers with
// something not on the list, the rule bot makes that lap's call instead,
// and the reason is marked "(fallback)".

import { RULES, COMPOUNDS, MODES } from "../race.js";
import * as bot from "./bot.js";
import { TO_ENGINE } from "../sim.js"; // AI words ("box_hard") → engine codes ("BOX_HARD")

export const WORKER_URL = "https://box-box-brain.pohping-ai.workers.dev/decide";
export const MODEL_LABEL = "Haiku 5.5";
const TIMEOUT_MS = 8000;

// The numbers the AI needs to plan, sent with every lap (so the
// instructions file never goes out of date when race.js changes).
const RULES_FOR_AI = {
  totalLaps: RULES.laps, pitLossSeconds: RULES.pitLoss, cliffAt: RULES.cliffAt,
  mustStopAtLeastOnce: true, tyres: COMPOUNDS, modes: MODES,
  note: "pace = seconds per lap vs normal Mediums (negative = faster); wear = tyre % lost per lap",
};

// Make a fresh strategist for one race. It keeps its own score card.
// onThinking(true/false) lets the page show "thinking…".
export function makeStrategist({ passcode, onThinking = () => {} }) {
  const stats = { calls: 0, fallbacks: 0, sims: 0, cost: 0 };
  let offline = null; // set when the Worker says no (wrong passcode, daily limit)

  async function decide(team, state) {
    if (offline) return fallback(team, state, offline);
    onThinking(true);
    try {
      const answer = await askWorker(passcode, state);
      stats.cost += answer.cost || 0;
      if (!answer.ok) {
        if (answer.stop) offline = answer.error; // no point asking again this race
        return fallback(team, state, answer.error);
      }
      const call = TO_ENGINE[answer.call];
      if (!call) return fallback(team, state, `unknown call "${answer.call}"`);
      stats.calls += 1;
      stats.sims += answer.sims.length;
      return { call, reason: answer.reason, extra: { brain: "ai", sims: answer.sims } };
    } finally {
      onThinking(false);
    }
  }

  function fallback(team, state, why) {
    stats.fallbacks += 1;
    const b = bot.decide(team, state);
    return { call: b.call, reason: `${b.reason} (fallback)`, extra: { brain: "fallback", why } };
  }

  return { name: `AI · ${MODEL_LABEL}`, decide, stats, isOffline: () => offline };
}

// Ask the Worker. Never throws: always returns { ok, ... }.
async function askWorker(passcode, state) {
  let res;
  try {
    res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode, state, rules: RULES_FOR_AI }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    const slow = e.name === "TimeoutError" || e.name === "AbortError";
    return { ok: false, error: slow ? "AI too slow (over 8s)" : "could not reach the brain" };
  }
  let body = {};
  try { body = await res.json(); } catch { /* not JSON: handled below */ }
  const cost = Number(body.cost || 0);
  if (!res.ok) {
    // Wrong passcode, daily limit or not set up: these won't fix themselves mid-race.
    const stop = [401, 403, 429, 500].includes(res.status);
    return { ok: false, stop, cost, error: body.error || `brain said ${res.status}` };
  }
  if (typeof body.call !== "string" || typeof body.reason !== "string") {
    return { ok: false, cost, error: "invalid answer" };
  }
  // sims = the "what if?" simulations the AI ran before deciding (step 3).
  const sims = Array.isArray(body.sims) ? body.sims.filter((x) => typeof x?.call === "string" && Number.isFinite(x?.finishGap)) : [];
  return { ok: true, call: body.call, reason: body.reason, cost, sims };
}
