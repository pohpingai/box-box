// strategist-loop.js — the conversation between the Worker and the AI for one lap.
//
//   AI: "Should I box?"  → simulate("box_hard now"), simulate("stay_out, box_medium on lap 12")
//   We run the real race engine (sim.js → race.js) and send back the predicted finish.
//   AI: make_call(box_hard, "Box, Hards. Simulation says +1.2s.")
//
// The AI talks to us only through "tools" (functions it may ask us to run):
//   simulate(now, box_on_lap?, box_tyre?) → what if I follow this plan? (max 3 per lap)
//   make_call(call, reason)               → my final answer for this lap.
// The team boss can switch simulate off; then only make_call is offered.

import { simulate } from "../sim.js";

export const CALLS = ["stay_out", "push", "normal", "save", "box_soft", "box_medium", "box_hard"];
const MAX_ROUNDS = 3;          // round 3 must be the final answer
export const MAX_SIMS_PER_LAP = 3;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "simulate",
      description:
        "Predict how the race ends if you follow a plan from now: a call now, and optionally one pit stop " +
        "on a later lap (box_on_lap + box_tyre). Examples: {now:'box_hard'}, " +
        "{now:'stay_out', box_on_lap:12, box_tyre:'medium'}. Assumes from the next lap on: no safety car, " +
        "no rain, no slow stops, the rival drives like a simple rule bot, and after your plan a sensible " +
        "default plan. Max 3 simulations per lap; you may ask for several at once.",
      parameters: {
        type: "object", additionalProperties: false, required: ["now"],
        properties: {
          now: { type: "string", enum: CALLS, description: "your call for this lap" },
          box_on_lap: { type: "integer", description: "optional: a later lap to pit on" },
          box_tyre: { type: "string", enum: ["soft", "medium", "hard"], description: "tyre for that later stop" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "make_call",
      description: "Your final call for this lap, with a short radio message (max 12 words).",
      parameters: {
        type: "object", additionalProperties: false, required: ["call", "reason"],
        properties: { call: { type: "string", enum: CALLS }, reason: { type: "string" } },
      },
    },
  },
];

// Check the final answer. Returns { call, reason } or throws.
export function checkAnswer(args) {
  let out = args;
  if (typeof args === "string") {
    try { out = JSON.parse(args); } catch { throw new Error("the AI's answer was not valid JSON"); }
  }
  const call = String(out?.call || "").trim().toLowerCase();
  if (!CALLS.includes(call)) throw new Error(`the AI chose "${out?.call}", which is not on the list`);
  const reason = String(out?.reason || "").replace(/\s+/g, " ").trim().slice(0, 140);
  if (!reason) throw new Error("the AI gave no reason");
  return { call, reason };
}

// Run the whole lap's conversation. `ask(messages, toolChoice)` sends one
// request to the AI and returns { message, cost }. Stops by `deadline` (ms timestamp).
export async function decideWithTools({ ask, system, state, rules, deadline, useSim = true }) {
  const tools = useSim ? TOOLS : TOOLS.filter((t) => t.function.name !== "simulate");
  const note = useSim ? "" : "\n\nThe simulate tool is switched OFF this race: decide without it.";
  const messages = [
    { role: "system", content: system },
    { role: "user", content: `Race situation:\n${JSON.stringify({ rules, state })}${note}\n\nYour call?` },
  ];
  const sims = [];
  let cost = 0;
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    if (Date.now() > deadline - 500) throw Object.assign(new Error("the AI took too long"), { cost, sims });
    const last = round === MAX_ROUNDS || !useSim || sims.length >= MAX_SIMS_PER_LAP;
    const choice = last ? { type: "function", function: { name: "make_call" } } : "required";
    let reply;
    try {
      reply = await ask({ messages, tools, tool_choice: choice }, deadline - Date.now());
    } catch (e) {
      throw Object.assign(e, { cost, sims });
    }
    cost += reply.cost;
    const msg = reply.message || {};
    const calls = msg.tool_calls || [];
    const final = calls.find((c) => c.function?.name === "make_call");
    if (final) {
      try {
        return { ...checkAnswer(final.function.arguments), cost, sims };
      } catch (e) {
        throw Object.assign(e, { cost, sims });
      }
    }
    if (!calls.length) throw Object.assign(new Error("the AI answered without using its tools"), { cost, sims });
    // Run each requested simulation and hand the results back.
    messages.push({ role: "assistant", content: msg.content || "", tool_calls: calls });
    for (const c of calls) {
      let result;
      try {
        if (c.function?.name !== "simulate" || !useSim) throw new Error(`tool "${c.function?.name}" is not available`);
        if (sims.length >= MAX_SIMS_PER_LAP) throw new Error(`limit of ${MAX_SIMS_PER_LAP} simulations this lap reached: make your call`);
        const r = simulate(state, JSON.parse(c.function.arguments || "{}"));
        sims.push({ plan: r.plan, finishGap: r.finishGap });
        result = { plan: r.plan, predicted: r.predicted, your_stops_by_the_end: r.ourStops };
      } catch (e) {
        result = { error: e.message };
      }
      messages.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(result) });
    }
  }
  throw Object.assign(new Error("the AI never made a call"), { cost, sims });
}
