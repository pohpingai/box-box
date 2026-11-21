/*
 * box-box-brain — the middleman between the Box Box page and the AI.
 * (A "Cloudflare Worker": a tiny program that runs on Cloudflare's servers.)
 *
 * Why it exists: the website is public, so it must NEVER hold the OpenRouter
 * key. The page sends the race situation here, this Worker adds the secret key,
 * asks the AI for a call, checks the answer, and sends back { call, reason }.
 *
 * Secrets (added by hand in the Cloudflare dashboard, never in this file):
 *   OPENROUTER_KEY — the OpenRouter API key
 *   PASSCODE       — the word the page must send before we spend any money
 *
 * One route: POST /decide   body: { passcode, state, rules }
 * Each lap the AI may first ask for simulations ("what if I box now?") before
 * its final call; that back-and-forth lives in strategist-loop.js.
 */

import { decideWithTools } from "./strategist-loop.js";

const SETTINGS = {
  MODEL: "anthropic/claude-haiku-5.5",
  ALLOWED_ORIGIN: "https://pohpingai.github.io",
  DAILY_LIMIT_USD: 0.2,
  // The strategist's instructions live on the website, so they can be edited
  // on GitHub without touching this Worker. Re-read at most once a minute.
  PROMPT_URL: "https://pohpingai.github.io/box-box/prompts/strategist.md",
  AI_TIMEOUT_MS: 7500, // the page gives up at 8s, so we give up a little sooner
};
const OPENROUTER = "https://openrouter.ai/api/v1";

// ---------- Small helpers ----------
function headers(extra = {}) {
  return {
    "Access-Control-Allow-Origin": SETTINGS.ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
    ...extra,
  };
}
function reply(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: headers({ "Content-Type": "application/json; charset=utf-8" }),
  });
}

// Compare passcodes without leaking how many letters matched.
async function sameText(a, b) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const x = new Uint8Array(ha), y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

// ---------- The strategist's instructions ----------
let prompt = { text: "", at: 0 };
async function loadPrompt() {
  if (prompt.text && Date.now() - prompt.at < 60_000) return prompt.text;
  const res = await fetch(SETTINGS.PROMPT_URL, { cf: { cacheTtl: 60 } });
  if (!res.ok) {
    if (prompt.text) return prompt.text; // keep the last good copy
    throw new Error(`could not load the strategist instructions (${res.status})`);
  }
  prompt = { text: await res.text(), at: Date.now() };
  return prompt.text;
}

// ---------- Spending limit ----------
// OpenRouter tells us how much this key has spent today (UTC day).
// We check it at most every 15s and add our own costs in between.
let spend = { today: 0, at: 0 };
async function spentToday(env) {
  if (Date.now() - spend.at < 15_000) return spend.today;
  const res = await fetch(`${OPENROUTER}/key`, {
    headers: { Authorization: `Bearer ${env.OPENROUTER_KEY}` },
  });
  if (!res.ok) throw new Error(`could not check spending (OpenRouter said ${res.status})`);
  const data = (await res.json()).data || {};
  spend = { today: Number(data.usage_daily || 0), at: Date.now() };
  return spend.today;
}

// ---------- Ask the AI (one request) ----------
async function askAI(env, request, msLeft) {
  const res = await fetch(`${OPENROUTER}/chat/completions`, {
    method: "POST",
    signal: AbortSignal.timeout(Math.max(500, msLeft)),
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_KEY}`,
      "Content-Type": "application/json",
      "X-Title": "Box Box - Strategist",
    },
    body: JSON.stringify({
      model: SETTINGS.MODEL,
      max_tokens: 300,
      // No silent "thinking" first: it's slower and used up the word budget.
      reasoning: { enabled: false },
      usage: { include: true },
      ...request, // messages, tools, tool_choice
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter said ${res.status}: ${(await res.text()).slice(0, 150)}`);
  const data = await res.json();
  if (data.error) throw new Error(`OpenRouter error: ${JSON.stringify(data.error).slice(0, 150)}`);
  return { message: data.choices?.[0]?.message, cost: Number(data.usage?.cost || 0) };
}

// ---------- The front door ----------
export default {
  async fetch(request, env) {
    const started = Date.now(); // the page waits 8s in total, so our clock starts now
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: headers() });
    if (request.method === "GET" && url.pathname === "/") {
      return reply(200, { ok: true, message: "box-box-brain is running. Use POST /decide." });
    }
    if (url.pathname !== "/decide") return reply(404, { error: "Only POST /decide lives here." });
    if (request.method !== "POST") return reply(405, { error: "Use POST." });
    // Only the Box Box website may use this brain.
    if (origin !== SETTINGS.ALLOWED_ORIGIN) return reply(403, { error: "This brain only works from the Box Box site." });
    if (!env.OPENROUTER_KEY || !env.PASSCODE) {
      return reply(500, { error: "The Worker is not set up yet: add the OPENROUTER_KEY and PASSCODE secrets." });
    }

    let body;
    try { body = await request.json(); } catch { return reply(400, { error: "Send JSON." }); }

    if (!(await sameText(String(body.passcode || ""), env.PASSCODE))) {
      await new Promise((r) => setTimeout(r, 1000)); // slow down guessers
      return reply(401, { error: "Wrong passcode." });
    }

    const state = body.state, rules = body.rules;
    const situation = JSON.stringify({ rules, state });
    if (!state || typeof state !== "object" || situation.length > 4000) {
      return reply(400, { error: "Send the race state as a small JSON object." });
    }

    try {
      const spent = await spentToday(env);
      if (spent >= SETTINGS.DAILY_LIMIT_USD) {
        return reply(429, { error: `Daily limit reached ($${spent.toFixed(3)} of $${SETTINGS.DAILY_LIMIT_USD}). Try again tomorrow.` });
      }
      const system = await loadPrompt();
      try {
        const out = await decideWithTools({
          ask: (request, msLeft) => askAI(env, request, msLeft),
          system, state, rules,
          deadline: started + SETTINGS.AI_TIMEOUT_MS,
        });
        spend.today += out.cost;
        return reply(200, out); // { call, reason, cost, sims }
      } catch (e) {
        // We may have paid for part of the conversation, so report the cost.
        spend.today += e.cost || 0;
        const slow = e.name === "TimeoutError" || e.name === "AbortError" || /too long/.test(e.message);
        return reply(slow ? 504 : 502, { error: slow ? "the AI took too long" : e.message, cost: e.cost || 0 });
      }
    } catch (e) {
      const slow = e.name === "TimeoutError" || e.name === "AbortError";
      return reply(slow ? 504 : 502, { error: slow ? "the AI took too long" : e.message });
    }
  },
};
