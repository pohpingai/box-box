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

## Step 3.7 — Two engineers with names ✅ done
- New voices, picked from the ElevenLabs voice library by their labels (conversational, not narration):
  - Team A → driver **Alex**, engineer **Hugh** (calm, confident British male; "calm authority and
    conversational warmth", made for lifelike agent conversations).
  - Team B → driver **Blake**, engineer **Mia** (energetic Australian female; "bright, upbeat …
    energetic and friendly", conversational delivery).
  - Also tried: Archer, Marcus (A); Kailey, Milly (B). Kailey measured flat and quiet, the opposite of energetic.
- 16 lines (8 per team), every line starts with the driver's name: "Alex, box box. Mediums.",
  "Blake, push now, push!" … Box + tyre is now ONE file per tyre. Old `v-*.mp3` files deleted.
- Much lighter radio effect: only the deepest rumble and the highest hiss are trimmed, no distortion,
  and the static click is quieter. Voices stay crisp.
- Both teams talk now (one radio channel, one voice at a time). Safety car: both engineers. Finish:
  the winner's engineer says "P1! Get in there!", then the other says "P2. We'll get them next time."
- While an engineer talks: that team's card, its car (flat strip AND the 3D car's ground glow, pulsing)
  and its radio line glow, with a "📻 Team A" badge on the card and on the 3D view.
- 🎧 Voice test button: plays one line from each team.
- Tested in the browser (375px + 1280px): voice test lights A then B; full monza race: both safety-car
  lines, both pit calls with the right radio line lit, "P1" for the winner then "P2", no errors.
  Engine files not changed.
- Note: the ElevenLabs key can't do speech-to-text, so clarity was checked by measuring the files
  (each word shows as its own burst of sound), not by machine transcription.

## Step 3.8 — Exciting music + sound effects ✅ done
- 3 race tracks to choose from, all 135 BPM, made once with ElevenLabs Music (punchy drums, driving bass,
  arpeggiated synths, F1-broadcast-intro energy, original): 1 = dark synthwave, 2 = electronic rock,
  3 = cinematic orchestral + synth hybrid.
- Each track has 3 levels: calm / building / climax. Each track was made as ONE song in sections, then
  cut on whole bars into 3 loops (8 bars ≈ 14s each), so the levels share key, tempo and instruments.
  The cuts were chosen by measuring each bar's loudness, brightness and busyness. Track 1's real intro
  is a slow filter sweep that can't loop, so its calm level is its building loop, muffled the same way.
- When the level or track changes, the new loop starts at the same point in the bar and cross-fades in
  (1.5s), so the beat never stumbles.
- Rules: calm by default, building when the gap is under 1s, climax in the last 3 laps (laps 18–20).
- 🎵 Music: 1 / 2 / 3 picker next to the sound controls (remembered in this browser). Switch any time,
  even mid-race. The label shows the track name and current level ("Electronic rock · building").
- Sound effects (ElevenLabs Sound Effects): whoosh on a pit stop, riser + impact on an overtake (P1 changes),
  short alarm on a safety car, crowd roar at the finish (with the finish sting).
- The old `race-loop` / `tension-loop` music is gone (the safety car now has its alarm; the gap rule
  usually lifts the music to "building" behind the safety car anyway).
- ElevenLabs key quota: the key has a 5,000-credit limit. Track 3 had to be made shorter (42s instead of
  96s), so its climax loop is 4 bars (7s) instead of 8. Remake it longer if the quota is raised.
- Tested in the browser (375px + 1280px, seed monza, Normal speed, switching to track 2 on lap 5 and
  track 3 on lap 10): every loop exactly 8 bars when decoded, switches keep the beat, climax from lap 18,
  alarm + whoosh on lap 7, riser + impact on each lead change, crowd + sting at the end, no errors.
  Engine files not changed.

## Extra: track export
- `exports/track.json` — the Las Vegas centre line used by the 3D view: 1,243 `[x, y, z]` points,
  5 m apart, in driving order (point 0 = start/finish). Same units and directions as the 3D scene
  (1 unit = 10 m, x = east, z = south, y = up; flat track so y = 0). Made by
  `node exports/make-track-json.js`, which reuses `three/track3d.js` (no copy).

## Extra: Blender landmarks + colour-true glow
- The owner's Blender model `models/heroes.glb` (geodesic dome, twisted tower, Ferris wheel) now stands
  in the 3D view, loaded with GLTFLoader (`three/heroes.js`). The three keep their spacing from Blender;
  the whole row was only moved and turned as one piece:
  - **Dome** in the middle of the infield (0, 0) — the camera circles that spot and always looks at it.
  - **Tower** 250 m north-north-west of it, so from the opening camera view it rises just behind the dome.
  - **Wheel** 500 m along the same line, off to the side.
  - Closest any part gets to the track's centre line: 80 m (dome platform). Checked vertex by vertex
    against `exports/track.json`.
- The old code-made dome and Ferris wheel are gone (`three/landmarks.js` removed). Three city towers
  that stood where the new landmarks are now make room; everything else in the city is unchanged.
- Glow re-tuned so colours stay true: ACES tone mapping kept (AgX was tried and turned more of the neon
  white), bloom only on really bright things (threshold 0.55 → 0.8) and gentler (0.9 → 0.6). Bright
  "washed-white" pixels fell from about 70% to 45% (most of what's left is the track's deliberately
  white-hot centre line and the tag text). Blender's glow strengths (3–5) are turned down in `heroes.js`.
- Tested: same race results as before on 8 seeds (engine untouched); browser race at 1280px and 375px,
  no 3D errors.

## Extra: make the landmarks stand out
- Landmarks shown at 2x size. The middle of the infield is too narrow for them at that size, so the row
  moved to the wide southern part: dome at (-17, 55), tower just north of the middle (-17, 5), wheel
  further north (-17, -45). Closest any part gets to the track's centre line: 104 m (dome platform),
  checked point by point against `exports/track.json`.
- City thinned out: no buildings outside the track loop any more; inside, 30 buildings, about three
  quarters of them clustered round the landmarks. (Light posts and little trees unchanged.)
- Tower glass made much clearer (see-through 0.5 → 0.12, dimmer glow), so its purple lines show
  instead of a solid purple block.
- Tested: same race results as before on 8 seeds (engine untouched); browser race at 1280px and 375px,
  no 3D errors.

## Extra: neon diorama look
- Camera: lower and closer, like looking at a model city — about 35° down, 1.75 km from the middle of
  the landmarks, still slowly circling them (phones a bit further back so everything fits).
- Floor: dark glossy floor that faintly mirrors the neon (three's Reflector, drawn at half screen size,
  a quarter on phones, to keep it cheap). The floating call tags are kept out of the mirror.
- Track: now a purple road — dark road surface, glowing purple edge lines, soft haze, faint centre line
  (no more white-hot core). Cars a bit smaller and each in its own lane, so the teal and orange trails
  stay teal and orange instead of adding up to white. Trails' white tip toned down.
- Removed the random gold "tree" dots and the grid sparkle dots. Small light posts now stand every
  60 m along both road edges.
- Faint purple fog for depth (the sky is the same deep purple, so the horizon melts away).
- Tested: same race results on 8 seeds (engine untouched); browser race at 1280px and 375px, no 3D errors.

## Extra: city kit + closer to the target picture
- Black night sky and black fog (the purple fog made everything murky). Purple grid back, with small
  glowing dots evenly at every crossing.
- Track: a bright neon tube — brighter, wider purple edges, the road surface glows, a wider soft halo,
  and a stronger, wider bloom.
- Camera: lower (25° down) and further back, so the whole circuit loops round the city, still circling slowly.
- City now built from the owner's Blender kit (`models/kit.glb`); all old code-made boxes and trees removed:
  - Downtown: 26 tall and medium buildings packed behind the dome round the twisted tower, each a bit
    taller or shorter (0.8–1.4x) and turned a different way.
  - 5 wide and curvy buildings on their own little round islands near the landmarks, trees round each.
  - 48 trees, 208 light posts (every 60 m on both edges of the road).
  - Nothing except the posts comes closer than 40 m to the track (closest: 42 m, checked against
    `exports/track.json`). Each kit part is drawn as one "instanced" mesh, so it stays fast on phones.
- Tested: same race results on 8 seeds (engine untouched); browser race at 1280px and 375px, no 3D errors.

## Extra: composition and scale
- Landmarks resized one by one: dome 1.3x (was 2x), twisted tower 1.3x wide and 1.5x tall (630 m, was
  840 m), Ferris wheel still 2x. They stay on the same spots; each is at least 160 m from the track.
- City kit now 2x, so downtown is a real skyline: up to 12 skyscrapers (340–700 m) plus medium blocks,
  all behind the twisted tower so the view from the dome to the tower stays open.
- Infield filled: islands of wide/curvy buildings, then a fill pass of small blocks and ~330 trees, so
  little bare floor shows. Still nothing (except light posts) within 40 m of the track.
- Glass is now fairly solid and glowing, so building faces read as lit purple panels, not hatching.
- Ground: smaller, dimmer dots; the grid and dots fade out with distance. The dome is kept out of the
  floor mirror (its gold rings made an orange blob under it); the mirror is dimmer overall.
- Camera closer (180 instead of 200), so the diorama fills most of the view.
- Tested: same race results on 8 seeds (engine untouched); browser race at 1280px and 375px, no 3D errors.

## Next: Step 4 — Team B on another model
Two different AI models race each other.
