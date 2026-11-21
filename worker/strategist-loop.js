// strategist-loop.js — the conversation between the Worker and the AI for one lap.
//
//   AI: "Should I box?"  → asks simulate(box_hard), simulate(stay_out)
//   We run the real race engine for each and send back the predicted finish.
//   AI: make_call(box_hard, "Box, Hards. Simulation says +1.2s.")
//
// The AI talks to us only through two "tools" (functions it may ask us to run):
//   simulate(call)          → what if I make this call now?
//   make_call(call, reason) → my final answer for this lap.

import { simulate } from "../sim.js";

export const CALLS = ["stay_out", "push", "normal", "save", "box_soft", "box_medium", "box_hard"];
const MAX_ROUNDS = 3;          // round 3 must be the final answer
const MAX_SIMS_PER_LAP = 6;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "simulate",
      description:
        "Predict how the race ends if you make this call now. Assumes from the next lap on: no safety car, " +
        "no rain, no slow stops, the rival drives like a simple rule bot, and you follow a sensible default plan. " +
        "You may ask for several calls at once.",
      parameters: {
        type: "object", additionalProperties: false, required: ["call"],
        properties: { call: { type: "string", enum: CALLS } },
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
export async function decideWithTools({ ask, system, state, rules, deadline }) {
  const messages = [
    { role: "system", content: system },
    { role: "user", content: `Race situation:\n${JSON.stringify({ rules, state })}\n\nYour call?` },
  ];
  const sims = [];
  let cost = 0;
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    if (Date.now() > deadline - 500) throw Object.assign(new Error("the AI took too long"), { cost, sims });
    const last = round === MAX_ROUNDS || sims.length >= MAX_SIMS_PER_LAP;
    const choice = last ? { type: "function", function: { name: "make_call" } } : "required";
    let reply;
    try {
      reply = await ask({ messages, tools: TOOLS, tool_choice: choice }, deadline - Date.now());
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
        if (c.function?.name !== "simulate") throw new Error(`unknown tool "${c.function?.name}"`);
        if (sims.length >= MAX_SIMS_PER_LAP) throw new Error("no more simulations this lap: make your call");
        const { call } = JSON.parse(c.function.arguments || "{}");
        const r = simulate(state, call);
        sims.push({ call: r.call, finishGap: r.finishGap });
        result = { call: r.call, predicted: r.predicted, your_stops_by_the_end: r.ourStops };
      } catch (e) {
        result = { error: e.message };
      }
      messages.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(result) });
    }
  }
  throw Object.assign(new Error("the AI never made a call"), { cost, sims });
}
