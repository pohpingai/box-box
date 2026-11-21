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

## Step 2 — Strategist agent ✅ done
- Team A's brain is now an AI (Claude Haiku 5.5 via OpenRouter). Team B is still the rule bot.
- Path: page → Cloudflare Worker `box-box-brain` → OpenRouter → AI → back.
  The OpenRouter key lives only in the Worker as a secret.
- Worker: one route `POST /decide`, passcode check, $0.20/day limit,
  only answers the pohpingai.github.io site.
- Instructions in `prompts/strategist.md` (editable; the Worker re-reads it every minute).
- Strict JSON answer, call from a fixed list of 7.
- Safety net: slow (over 8s), broken or invalid answer → rule bot makes that
  lap's call, marked "(fallback)". Wrong passcode / daily limit → rule bot
  for the rest of the race, with one radio message.
- Page: race waits while Team A is "thinking…", passcode box (remembered in
  this browser), and after the race: AI calls, fallbacks, approximate cost.
- Tested: 300 seeds give identical results to step 1 with bot vs bot; a real AI
  race made 20/20 valid calls in about 1–2.5s each, roughly $0.003 per race
  (so about 60 races fit in the $0.20 daily limit).

### Learned
- Haiku 5.5 "thinks" quietly before answering. With a small word budget it used
  it all on thinking and never answered, so the Worker turns thinking off.

## Next: Step 3 — simulate() tool
Let the strategist test "what if I box now?" before making a call.
