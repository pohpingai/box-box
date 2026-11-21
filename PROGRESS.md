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

## Step 2.1 — Clearer position + race controls ✅ done
- The AI now gets `"position": "P1"/"P2"` and a plain sentence, e.g.
  "Start of lap 20 of 20: you are P1, 0.23s AHEAD of the rival."
  (It wasn't wrong before: in monza it led at the start of laps 18–20 and lost
  0.31s on the last lap. The screen made it look wrong.)
- Radio lines show the start-of-lap position: "Lap 20 · A (P1, 0.23s ahead): Push now".
- Speed: Slow (4s/lap, default), Normal (2s), Fast (0.5s). Pause / Play, Next lap.
- Auto-pause (tick box, on by default) after a safety car starts, rain starts or
  any pit stop, with a yellow banner saying why.
- After the race: a lap slider replays any lap (tower, flags and radio as they were).

## Step 2.2 — Position bug fix ✅ done
- Bug: the position sent to a brain was worked out from the gap AFTER rounding
  to 0.01s. When cars were less than 0.005s apart the gap showed 0.00 and BOTH
  teams were told "P1" (69 of 20,000 laps over 1000 test races). Now the position
  comes from the exact times, the same order the screen shows: 0 errors.
- Radio lines show exactly what the brain was told: "Lap 20 · A (told: P1, +0.23s ahead)".
- New radio note when the lead changes DURING a lap: "🔁 Team B takes P1 during this lap".
  (In monza Team A really led at the start of laps 18–20 and lost it on the last lap.)
- Checked on monza in the browser with the real AI: told position = screen 20/20 laps.

## Step 3 — simulate() tool ✅ done
- The AI can ask "what if?" before deciding: simulate(box_hard), simulate(stay_out), …
  then make_call. Example (monza, lap 3): stay_out → 4.76s behind, box_hard → 2.48s behind
  → "Box for Hards now. Simulation shows best finish."
- The simulation runs the real race engine from the team's own view only: no seed, so no
  peeking at future safety cars, rain or slow stops. It assumes a clean race from the next lap,
  that the rival drives like the rule bot, and that we follow the rule bot's plan afterwards.
- Accuracy check (141 clean bot-vs-bot races): winner predicted right 137/141, average gap
  error 2.4s (mostly random slow stops and lap-to-lap luck, which it ignores on purpose).
- Radio shows the simulations under each call; the result shows the number of simulations.
- Real AI vs rule bot: Team A won monza (+1.99s), spa (+3.87s) and suzuka (+4.63s).
  About 30–40 simulations and ~$0.01 per race, slowest lap under 3s, 0 fallbacks.
- Known limit: when Team B gets an AI brain (step 4), "rival = rule bot" is no longer true.

## Next: Step 4 — Team B on another model
Two different AI models race each other.
