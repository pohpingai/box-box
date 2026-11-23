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
- Team A's AI can test plans before deciding, using real tool calling via OpenRouter:
  simulate({now: "box_hard"}) or simulate({now: "stay_out", box_on_lap: 12, box_tyre: "medium"})
  → predicted finish gap vs the rival. Then make_call(call, reason).
- No cheating: the simulation starts from what the team can see, never the race's seed, so it
  can't know future safety cars, rain or slow stops. It assumes a normal race from now on,
  a rule-bot rival, and the rule bot's plan after yours.
- Shared code: the Worker runs `sim.js`, which runs the real `race.js` (same formulas, no copy).
- Max 3 simulations per lap. AI time limit raised from 8s to 15s.
- Prompt: "Before any pit or tyre decision, test your options with simulate() and choose the best result."
- Page: "Tools: ☑ simulate" checkbox on Team A's card (remembered in this browser); radio shows
  "🔧 tested: box_hard now → 2.48s behind · stay_out, box_hard on lap 10 → 6.84s ahead";
  the result shows tool calls used and cost.
- Accuracy (141 clean bot-vs-bot races): winner predicted right 137/141, average gap error 2.4s.

### Test: seed monza, real AI vs the rule bot (2 runs each)
| simulate | Result | Tool calls | Cost | Slowest lap | Fallbacks |
|---|---|---|---|---|---|
| ON  | Team A wins by 2.17s (both runs) | 57 | $0.013 | 2.7s | 0 |
| OFF | Team B wins by 0.08s (both runs) | 0  | $0.005 | 1.5s | 0 |

- The AI simulated on almost every lap (57 of a possible 60), even quiet ones.
- Known limit: when Team B gets an AI brain (step 4), "rival = rule bot" is no longer true.

## Step 3.5 — 3D Las Vegas night view ✅ done
(An early taste of step 9. The engine and the brains are untouched.)
- A 3D night view of the race above the lap counter, made with Three.js. No build step:
  Three.js (version 0.170) is kept in the repo in `vendor/three/`, so the live site needs
  no outside website, and the page loads it with an "import map".
- The track is the real Las Vegas Strip Circuit, the same outline as the mini game in
  pohpingai/f1-news (read only, not changed). Copied into `track/vegas.js` with its MIT licence.
- The look: dark city, faint street grid, tiny city lights, box buildings with glowing gold
  edges (about 1 in 7 purple/pink), a glowing sphere and a Ferris wheel roughly where the
  real ones are, a glowing track ribbon (white core, red edge, blue edge), bloom glow,
  and a drone camera that circles the city slowly (one lap every 150s).
- Team A (teal) and Team B (orange) are glowing dots with light trails. Honest, simple
  movement: the engine works in whole laps, so in each lap's playback the leader goes once
  round and the other car sits behind it by the real time gap (90s = one whole lap).
- Big moments: "SAFETY CAR" (track edges also turn yellow), "BOX BOX" (in the team's colour),
  "OVERTAKE" (when P1 changes). A glowing word pops up over the car and the camera swoops in
  for 2 seconds.
- Radio: the newest messages float over the 3D view (2 on phones, 4 on wider screens).
  The full radio card is still below.
- Safe: if 3D can't start (old phone, a file fails to load) the page keeps the old flat strip
  and the race works as before. "Reduce motion" setting → the camera holds still, no swoops.
  It only draws while it's on screen (saves battery).
- Tested in the browser at 375px and 1280px: full race on Fast, replay slider, reduced
  motion, and the "3D failed to load" fallback. No errors.

### Fix 3.5.1 — 3D view missing on the owner's phone
- On the owner's phone the 3D view didn't show at all (laptop was fine). Most likely cause: the
  page used an "import map" to find Three.js, which older phone browsers (iPhone before iOS 16.4)
  don't understand, and the failure was hidden on purpose so the race kept working.
- Fixes: no import map any more (files point straight at `vendor/three/`), and if 3D can't start
  the box now says why in plain words instead of disappearing. The race still works either way.
- Tested: iPhone/Pixel/Galaxy screen sizes, "file failed to load" and "no WebGL" cases.

### Redesign 3.5.2 — "hologram" look (matches the owner's reference picture)
- Replaced the random gold boxes completely. Now: an endless black floor with a faint purple grid;
  buildings drawn as glowing wireframes (edges and window lines only) in purple and gold, packed
  inside the circuit with a few tall tapered towers; a gold wireframe geodesic dome and Ferris wheel;
  light posts along the track and little gold trees.
- Track: a thin glowing purple-white neon line (same real Las Vegas layout).
- Cars: small glowing car shapes with long light trails (teal A, orange B).
- New: a floating hologram tag above each car with its current call, e.g. "A · BOX MEDIUMS".
  It also follows the replay slider.
- Glow (bloom) is turned down automatically during camera close-ups so they don't wash out.
- Tested: screenshots compared with the reference picture and improved once (bigger cars, longer
  trails, tags no longer overlap, dome less blown out, brighter grid, fewer buildings, calmer
  close-ups). Same seed = same race. Full race on Fast at 375px, replay slider, reduced motion: no errors.

## Step 3.6 — Sound ✅ done
(An early taste of step 8's voice. The engine and the brains are untouched.)
- Music and voice made ONCE with ElevenLabs and saved as mp3 files in `audio/` (1.4 MB in all).
  The site never calls ElevenLabs: no key on the page, no cost per visit.
- Music (ElevenLabs Music): `race-loop` (calm dark synthwave, 38s), `tension-loop` (faster, for the
  safety car, 30s), `finish` (7s triumphant sting). The two loops were made seamless: the last 2s
  fade into the start, so they repeat without a jump.
- Voice: ElevenLabs voice "Daniel" (steady British male): "Box box, box box.", "Stay out, stay out.",
  "Push now, push.", "Safety car, safety car.", "Mediums.", "Hards.", "Softs.", "P1! Get in there!",
  "P2. We'll get them next time." All voice files evened out to the same loudness.
- On the page: music starts on RUN RACE, cross-fades to the tension loop while the safety car is out
  and back after, then the finish sting + "P1!"/"P2." for Team A at the end.
- Team A's call → its engineer line through a "radio" filter (thin phone-like sound, a little grit)
  with a burst of static before and after (made in the browser, no file).
- No "Stay out" on every lap: a line plays when Team A's call CHANGES; pit stops always play.
  Normal pace / Save tyres have no line. If the engineer is still talking, ordinary lines wait for
  the next lap; important ones (pit stop, safety car, finish) queue up.
- 🔊 mute button + volume slider next to RUN RACE (remembered in this browser).
- Safe: phones only allow sound after a tap, so sound switches on with RUN RACE. If sound can't
  start or a file is missing, the race runs silently, as before.
- Tested in the browser (375px + 1280px, seed monza, Fast): every sound played in order (push, stay out,
  safety car + tension music laps 7–9, box + hards, finish sting, "P2"), mute works, no errors;
  also with all sound files missing: race finishes, no errors. Engine files not changed.
- Known: on Fast (0.5s/lap) the radio runs a few laps behind, because a line is longer than a lap.

## Next: Step 4 — Team B on another model
Two different AI models race each other.
