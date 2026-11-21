// race.js — the Box Box race engine.
// Plain JavaScript, no build step. Works in the browser and in Node.
//
// How it works, in one breath:
//   Every lap we ask each team "what do you want to do?" (decide()),
//   apply the call, work out a lap time with simple formulas, and log it.

// ---------- Settings (all the numbers live here) ----------
export const RULES = {
  laps: 20,
  baseLap: 90,          // seconds for a clean lap on fresh Mediums
  pitLoss: 20,          // seconds lost in the pit lane
  slowStopChance: 0.15, // chance a stop goes wrong
  slowStopExtra: [4, 8],// extra seconds when it does
  wornPenalty: 4,       // seconds lost at 0% tyre (scales linearly)
  cliffAt: 20,          // below this tyre %, the tyre "falls off a cliff"
  cliffPenalty: 3,      // extra seconds once over the cliff
  noise: 0.3,           // +/- random seconds per lap (driver variation)
  scLap: 110,           // lap time behind the safety car
  rainPenalty: 3,       // seconds slower per lap in the rain
  startCompound: { A: "medium", B: "soft" },
};

// Each compound trades speed for life.
export const COMPOUNDS = {
  soft:   { pace: -0.6, wear: 8.5 },
  medium: { pace:  0.0, wear: 4.0 },
  hard:   { pace: +0.8, wear: 2.5 },
};

// How the driver is driving. Push = faster but eats tyres.
export const MODES = {
  save:   { pace: +0.5, wear: 0.6 },
  normal: { pace:  0.0, wear: 1.0 },
  push:   { pace: -0.6, wear: 1.5 },
};

// ---------- Seeded random numbers ----------
// Same seed in → same race out. (mulberry32: tiny and good enough.)
export function seedToNumber(seed) {
  const s = String(seed);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
export function makeRng(seed) {
  let a = seedToNumber(seed);
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const between = (rng, lo, hi) => lo + rng() * (hi - lo);
const intBetween = (rng, lo, hi) => Math.floor(between(rng, lo, hi + 1));

// ---------- Surprises, planned from the seed before the start ----------
function planSurprises(rng) {
  const s = { safetyCar: null, rain: null };
  if (rng() < 0.45) {
    const start = intBetween(rng, 4, 15);
    s.safetyCar = { start, end: start + intBetween(rng, 1, 2) }; // 2–3 laps
  }
  if (rng() < 0.35) {
    const start = intBetween(rng, 6, 14);
    s.rain = { start, end: start + intBetween(rng, 2, 4) };      // 3–5 laps
  }
  return s;
}
const isOn = (window, lap) => !!window && lap >= window.start && lap <= window.end;

// ---------- The calls a team can make ----------
// STAY, PUSH, NORMAL, SAVE, BOX_SOFT, BOX_MEDIUM, BOX_HARD
export const CALLS = ["STAY", "PUSH", "NORMAL", "SAVE", "BOX_SOFT", "BOX_MEDIUM", "BOX_HARD"];

// Turn a call into words for the radio: "Box, Hards".
export function callToWords(call) {
  if (call.startsWith("BOX_")) {
    const c = call.slice(4).toLowerCase();
    return `Box, ${c[0].toUpperCase()}${c.slice(1)}s`;
  }
  return { STAY: "Stay out", PUSH: "Push now", NORMAL: "Normal pace", SAVE: "Save tyres" }[call] || call;
}

// ---------- Create a race ----------
// deciders = { A: decideFn, B: decideFn }. Each returns {call, reason}.
export function createRace(seed, deciders) {
  const rng = makeRng(seed);
  const surprises = planSurprises(rng);
  const cars = {};
  for (const team of ["A", "B"]) {
    cars[team] = {
      team,
      compound: RULES.startCompound[team],
      tyre: 100,
      mode: "normal",
      time: team === "A" ? 0 : 0.5, // B starts half a second behind
      stops: 0,
      lastLap: 0,
    };
  }
  return {
    seed: String(seed),
    lap: 0,
    surprises,
    cars,
    events: [],   // the log: {lap, team, state, call, reason}
    news: [],     // things that happened: {lap, text}
    done: false,
    rng,
    deciders,
  };
}

// What a team is allowed to see when deciding.
export function teamView(race, team) {
  const rival = team === "A" ? "B" : "A";
  const me = race.cars[team], them = race.cars[rival];
  const lap = race.lap + 1;
  const gap = +(me.time - them.time).toFixed(2); // negative = I'm ahead
  // Position comes from the exact times, the same order the screen shows
  // (standings). NOT from the rounded gap: a 0.004s gap rounds to 0.00,
  // which used to tell BOTH cars they were P1.
  const position = standings(race)[0].team === team ? "P1" : "P2";
  return {
    // A plain sentence first, so nobody (human or AI) has to decode the sign of the gap.
    situation: describe(lap, position, gap),
    lap,
    lapsLeft: RULES.laps - lap + 1, // including this one
    totalLaps: RULES.laps,
    position,
    gapToRival: gap,
    safetyCar: isOn(race.surprises.safetyCar, lap),
    rain: isOn(race.surprises.rain, lap),
    me: { compound: me.compound, tyre: Math.round(me.tyre), mode: me.mode, stops: me.stops },
    rival: { compound: them.compound, tyre: Math.round(them.tyre), mode: them.mode, stops: them.stops },
  };
}

// "Start of lap 20 of 20: you are P1, 0.23s AHEAD of the rival."
function describe(lap, position, gap) {
  const where = Math.abs(gap) < 0.01
    ? `less than 0.01s ${position === "P1" ? "AHEAD of" : "BEHIND"}`
    : `${Math.abs(gap).toFixed(2)}s ${gap < 0 ? "AHEAD of" : "BEHIND"}`;
  return `Start of lap ${lap} of ${RULES.laps}: you are ${position}, ${where} the rival.`;
}

// Run one lap. Returns the new events for this lap.
// For brains that answer instantly (like the rule bot).
export function stepLap(race) {
  if (race.done) return [];
  const lap = beginLap(race);
  const decisions = {};
  for (const team of ["A", "B"]) {
    const state = teamView(race, team);
    decisions[team] = applyRules(race, team, lap, state, safeDecide(race.deciders[team], team, state));
  }
  return applyLap(race, lap, decisions);
}

// Same as stepLap, but waits for brains that need time to think (like an AI
// over the internet). The race simply pauses until both teams have answered.
export async function stepLapAsync(race) {
  if (race.done) return [];
  const lap = beginLap(race);
  const teams = ["A", "B"];
  const states = teams.map((team) => teamView(race, team));
  const answers = await Promise.all(teams.map((team, i) => safeDecideAsync(race.deciders[team], team, states[i])));
  const decisions = {};
  teams.forEach((team, i) => (decisions[team] = applyRules(race, team, lap, states[i], answers[i])));
  return applyLap(race, lap, decisions);
}

// Announce surprises that start or end this lap. Returns the lap number.
function beginLap(race) {
  const lap = race.lap + 1;
  if (race.surprises.safetyCar?.start === lap) race.news.push({ lap, text: "🟡 SAFETY CAR deployed" });
  if (race.surprises.safetyCar?.end + 1 === lap) race.news.push({ lap, text: "🟢 Safety car in, racing resumes" });
  if (race.surprises.rain?.start === lap) race.news.push({ lap, text: "🌧️ Rain is falling" });
  if (race.surprises.rain?.end + 1 === lap) race.news.push({ lap, text: "☀️ Track drying" });
  return lap;
}

// Rule: every car must stop at least once. Last lap with no stop = forced stop.
function applyRules(race, team, lap, state, answer) {
  let { call, reason } = answer;
  if (lap === RULES.laps && race.cars[team].stops === 0 && !call.startsWith("BOX_")) {
    call = "BOX_SOFT";
    reason = `Forced by the rules: no stop yet (team said: ${reason})`;
  }
  return { call, reason, state, extra: answer.extra };
}

// Apply both teams' calls (asked first, so neither saw the other's call).
function applyLap(race, lap, decisions) {
  const sc = isOn(race.surprises.safetyCar, lap);
  const rain = isOn(race.surprises.rain, lap);
  const newEvents = [];

  // 2) Apply calls and work out lap times.
  for (const team of ["A", "B"]) {
    const car = race.cars[team];
    const { call, reason, state, extra } = decisions[team];
    // Under the safety car everyone drives at the same slow pace.
    let lapTime = sc ? RULES.scLap : lapTimeFor(car, rain, race.rng);
    let pitNote = "";

    if (call === "PUSH") car.mode = "push";
    if (call === "SAVE") car.mode = "save";
    if (call === "NORMAL") car.mode = "normal";
    if (call.startsWith("BOX_")) {
      let loss = RULES.pitLoss;
      if (race.rng() < RULES.slowStopChance) {
        const extra = +between(race.rng, ...RULES.slowStopExtra).toFixed(1);
        loss += extra;
        pitNote = ` (slow stop, +${extra}s)`;
        race.news.push({ lap, text: `🐌 Slow stop for Team ${team}: +${extra}s` });
      }
      lapTime += loss;
      car.compound = call.slice(4).toLowerCase();
      car.tyre = 100;
      car.mode = "normal";
      car.stops += 1;
    } else {
      wearTyre(car, rain);
    }
    car.lastLap = lapTime;
    car.time += lapTime;
    const ev = { lap, team, state, call, reason: reason + pitNote, lapTime: +lapTime.toFixed(2), ...extra };
    race.events.push(ev);
    newEvents.push(ev);
  }

  // 3) Safety car bunches the field: the gap halves each SC lap.
  if (sc) {
    const [lead, back] = race.cars.A.time <= race.cars.B.time ? ["A", "B"] : ["B", "A"];
    const gap = race.cars[back].time - race.cars[lead].time;
    race.cars[back].time = race.cars[lead].time + gap / 2;
  }

  race.lap = lap;
  if (lap >= RULES.laps) race.done = true;
  return newEvents;
}

// Lap time = base + compound + mode + worn tyre + cliff + rain + a little luck.
function lapTimeFor(car, rain, rng) {
  const c = COMPOUNDS[car.compound], m = MODES[car.mode];
  let t = RULES.baseLap + c.pace + m.pace;
  t += ((100 - car.tyre) / 100) * RULES.wornPenalty;
  if (car.tyre < RULES.cliffAt) t += RULES.cliffPenalty;
  if (rain) t += RULES.rainPenalty;
  t += between(rng, -RULES.noise, RULES.noise);
  return t;
}

// Tyres wear each lap. Rain is cooler, so they wear slower.
function wearTyre(car, rain) {
  const w = COMPOUNDS[car.compound].wear * MODES[car.mode].wear * (rain ? 0.6 : 1);
  car.tyre = Math.max(0, car.tyre - w);
}

// If a brain crashes or answers nonsense, stay out and say why.
function safeDecide(fn, team, state) {
  try {
    return cleanAnswer(fn(team, state));
  } catch (e) {
    return { call: "STAY", reason: `Brain error: ${e.message}` };
  }
}
async function safeDecideAsync(fn, team, state) {
  try {
    return cleanAnswer(await fn(team, state));
  } catch (e) {
    return { call: "STAY", reason: `Brain error: ${e.message}` };
  }
}
// "extra" = optional notes a brain wants saved in the log (e.g. AI or fallback).
function cleanAnswer(out = {}) {
  out = out || {};
  if (!CALLS.includes(out.call)) return { call: "STAY", reason: `Bad call "${out.call}", staying out` };
  return { call: out.call, reason: String(out.reason || "no reason given"), extra: out.extra };
}

// ---------- Results and the log ----------
export function standings(race) {
  return ["A", "B"]
    .map((t) => race.cars[t])
    .sort((x, y) => x.time - y.time);
}

export function result(race) {
  const [p1, p2] = standings(race);
  return {
    winner: p1.team,
    margin: +(p2.time - p1.time).toFixed(2),
    times: { A: +race.cars.A.time.toFixed(2), B: +race.cars.B.time.toFixed(2) },
    stops: { A: race.cars.A.stops, B: race.cars.B.stops },
  };
}

export function exportLog(race, brains, aiStats = null) {
  return {
    game: "Box Box",
    step: 2,
    seed: race.seed,
    brains,
    rules: RULES,
    surprises: race.surprises,
    news: race.news,
    result: race.done ? result(race) : null,
    aiStats,
    events: race.events,
  };
}

// Run a whole race at once (handy for tests and, later, the judge).
export function runRace(seed, deciders) {
  const race = createRace(seed, deciders);
  while (!race.done) stepLap(race);
  return race;
}
