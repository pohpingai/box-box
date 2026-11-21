# Progress

## Step 1 — Engine ✅ done
- `race.js`: 2 cars, 20 laps, Soft/Medium/Hard, tyre %, save/normal/push,
  +20s pit stop, must stop at least once (forced on the last lap if not).
- Surprises from the seed: safety car (~45% of races), rain (~35%),
  slow pit stop (15% of stops). Same seed always gives the same race.
- Every lap both teams are asked `decide(team, state) → {call, reason}`,
  logged as `{lap, team, state, call, reason, lapTime}`.
- `agents/bot.js`: the rule bot (safety car → box, tyres < 25% → box,
  close gap → push, worn tyres → save).
- Team Boss screen: team cards (with greyed-out slots for model/style/tools),
  seed + RUN RACE, live lap/positions/gap/tyre bars, radio feed, result,
  Download log (JSON). Works on a phone.
- Balance check over 200 seeds with the same bot on both sides:
  Team A (starts Medium) wins ~42%, Team B (starts Soft) ~58%.

### Known simple bits (on purpose, for now)
- No overtaking model: position is just who has the lower total time.
- No wet tyres: rain just makes everyone slower and wears tyres less.

## Next: Step 2 — Strategist agent
Swap Team A's rule bot for an AI model, through a small backend so no API key
ever sits in the browser.
