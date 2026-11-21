// agents/bot.js — the "Rule bot" brain.
// A few if/then rules, like a cautious strategist with a checklist.
// Later, AI agents will replace this with the same shape:
//   decide(team, state) → { call, reason }

export const name = "Rule bot";

export function decide(team, state) {
  const { me, lapsLeft, safetyCar, rain, gapToRival } = state;
  const nextTyre = lapsLeft > 10 ? "HARD" : lapsLeft > 5 ? "MEDIUM" : "SOFT";

  // 1. A safety car makes a stop cheap: everyone is slow, and the gap shrinks.
  if (safetyCar && me.stops === 0 && lapsLeft > 2) {
    return { call: `BOX_${nextTyre}`, reason: "safety car, cheap stop" };
  }
  // 2. Must stop once. Don't leave it to the very end.
  if (me.stops === 0 && lapsLeft <= 2) {
    return { call: "BOX_SOFT", reason: "mandatory stop, running out of laps" };
  }
  // 3. Tyres are nearly gone.
  if (me.tyre < 25 && lapsLeft > 2) {
    return { call: `BOX_${nextTyre}`, reason: `tyres at ${me.tyre}%` };
  }
  // 4. Rain: keep it on the road.
  if (rain) {
    return me.mode === "save" ? { call: "STAY", reason: "rain, still saving" }
                              : { call: "SAVE", reason: "rain, look after the car" };
  }
  // 5. Close fight and good tyres: attack (or defend).
  if (Math.abs(gapToRival) < 2 && me.tyre > 50 && me.mode !== "push") {
    return { call: "PUSH", reason: `gap only ${Math.abs(gapToRival).toFixed(1)}s` };
  }
  // 6. Tyres getting tired: ease off.
  if (me.tyre < 45 && me.mode !== "save") {
    return { call: "SAVE", reason: `tyres at ${me.tyre}%, easing off` };
  }
  // 7. Back to normal once the fight is over.
  if (me.mode === "push" && (Math.abs(gapToRival) >= 2 || me.tyre <= 50)) {
    return { call: "NORMAL", reason: "fight over, back to normal pace" };
  }
  return { call: "STAY", reason: "all good, stay out" };
}
