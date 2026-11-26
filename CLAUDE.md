# Box Box — AI pit wall lab

## The goal
Learn how AI agents work by building them. Formula 1 strategy is just the test
track: a small, clear world where an agent has to make calls (pit now? push?
save tyres?), explain why, and live with the result.

The user is the **team boss**. They don't drive or make calls. They set up the
AI "brains" for each team, watch the race, and compare which brain did better.

## Rules for working in this repo
- **Small files.** One job per file. If a file gets long, split it.
- **Explain in layman words.** Comments, commit messages and summaries should
  make sense to someone who isn't a programmer.
- **Never put API keys in the frontend.** This site is public on GitHub Pages.
  Any AI call that needs a key goes through a small backend/proxy (from step 2).
- **Plain JS, no build step.** Open `index.html` (via any static server) and it works.
- **Same seed = same race.** All randomness goes through the seeded `rng` in
  `race.js`. Never use `Math.random()` inside the engine.
- **One brain shape for everyone:** `decide(team, state) → { call, reason }`.
  Rule bot, AI strategist, anything else — same shape, so they can be swapped.
  An AI brain may return a Promise (it takes time to think); the page uses
  `stepLapAsync` so the race waits. Optional `extra` fields get saved in the log.
- **AI brains always have a safety net:** if the AI is slow (over 15s), breaks or
  answers something not on the list, the rule bot makes that lap's call, marked "(fallback)".
- **Prompts are readable files** in `prompts/`, so the owner can edit them on GitHub.
- Update `PROGRESS.md` at the end of each step.
- **Merge into `main` when tests pass — no need to ask.** Work on a branch, test
  (engine regression + a browser check), then fast-forward `main` and push. `main` is the live site.

## Files
- `race.js` — race engine: tyres, modes, pit stops, surprises, lap log.
- `agents/bot.js` — the rule bot brain (if/then checklist).
- `agents/strategist.js` — the AI brain (page side): asks the Worker, 15s timeout, fallback, score card.
- `sim.js` — the simulate(plan) tool: replays the rest of the race with the real engine (shared
  code, never a copy) from the team's own view (no seed, so no peeking at future surprises;
  rival assumed = rule bot). Plan = `{now, box_on_lap?, box_tyre?}`.
- `prompts/strategist.md` — the AI strategist's instructions (the Worker reads it from the live site).
- `worker/box-box-brain.js` — Cloudflare Worker: passcode, $0.20/day limit, only pohpingai.github.io,
  calls OpenRouter (`anthropic/claude-haiku-5.5`). Secrets: `OPENROUTER_KEY`, `PASSCODE`. See `worker/README.md`.
- `worker/strategist-loop.js` — one lap's AI conversation: tools `simulate` and `make_call`,
  max 3 rounds (the last forces make_call), max 3 simulations per lap, all inside 14.5s.
  The page's "☑ simulate" checkbox sends `tools: false` to switch simulate off.
- `ui.js`, `index.html`, `style.css` — the Team Boss screen (wiring).
- `ui-player.js` — race clock: Slow 4s (default) / Normal 2s / Fast 0.5s per lap, Pause, Next lap.
- `ui-draw.js` — draws one moment ("frame") and the radio feed. Radio call lines show the
  team's position at the START of the lap (what it saw when it made the call).
- `ui-replay.js` — saves a frame after every lap for the replay slider.
- `ui-stage.js` — loads the 3D view in the background; if it fails, the flat strip stays.
- `ui-audio.js` — the sound desk: loads/plays sounds, volume + mute, sound effects (pit whoosh, overtake
  riser, safety-car alarm, finish crowd). Web Audio; starts on a tap (phones need one). Fails silently.
- `ui-music.js` — race music: 3 tracks × calm/building/climax loops (135 BPM, whole bars). Calm default,
  building when the gap < 1s, climax in the last 3 laps. Level/track changes stay on the beat.
- `ui-voice.js` — the two race engineers: call → voice line, light radio filter + soft static click,
  one channel with a queue; `onSpeak(team, key)` makes the speaking team's card/car/radio line glow.
- `audio/` — mp3s made ONCE with ElevenLabs. The site never calls ElevenLabs. Music: `m{1,2,3}-{calm,building,climax}`
  (1 synthwave, 2 electronic rock, 3 cinematic hybrid; cut from one song per track) and `finish`.
  Sound effects: `sfx-whoosh/overtake/alarm/crowd`. Voices: `a-*.mp3` (Team A, driver Alex, library voice "Hugh"
  `2UMI2FME0FFUFMlUoRER`) and `b-*.mp3` (Team B, driver Blake, library voice "Mia" `Vufs5CYVtQ9JvjTN0Hs4`):
  `box-soft/box-medium/box-hard/stay/push/sc/p1/p2`. Every line starts with the driver's name.
  To remake one: ElevenLabs `POST /v1/music` or `/v1/text-to-speech/<voice id>`, then
  even out loudness with ffmpeg `loudnorm`. Music loops: make one song with a `composition_plan`
  (3 sections), cut whole bars, and cross-fade the bar after the loop into its first half bar.
  Sound effects: `POST /v1/sound-generation`. The key has a 5,000-credit quota — check before big jobs.
- `three/` — the 3D Las Vegas night race, shown like an F1 TV broadcast (step 3.5+): `view.js` (puts it together),
  `director.js` (the TV director: CHASE (behind the car in 2nd, slight lag) / TURN n (fixed trackside cams that
  pan to follow) / HELI (high orbit round the dome) / OVERVIEW (only before the start, at the finish, while
  paused); auto-cut every 6–8 s and at once on pit stop / overtake / safety car (that shot holds even if the
  race auto-pauses); 0.4 s fade through black; `?cam=chase|turn|heli|overview` locks one camera),
  `camspots.js` (the 5 trackside cameras: turns 1, 3, 7, 10, 12 — our own bend count, close to but not the
  official 17), `post.js` (film look: render → depth of field (BokehPass, big screens) → tags/words overlay
  (always sharp) → bloom (threshold 0.8) → ACES → SMAA (big screens) → `film.js` vignette + light grain + cut
  fade), `track3d.js` (outline → 3D points), `ribbon.js` (purple neon road: 30 m, bright purple edges, glowing
  surface, wide soft haze; dimmed on close shots so it stays purple), `floor.js` (wet-road floor: three's
  Reflector at 0.35 screen size (0.2 on phones), blurred into vertical streaks (14 taps, 6 on phones), dimmed +
  fogged; purple grid + small dots fading with distance; dome kept out of the mirror), `city.js` + `city-layout.js`
  (the city from `models/kit.glb` — see below), `heroes.js` (loads `models/heroes.glb` and places it — see below),
  `cars.js` (small car shapes + long light trails), `tags.js` (floating "A · BOX MEDIUMS" call tag
  above each car — reads `frame.calls` from `ui-replay.js`), `labels.js` (pop-up words).
  Cars drive in lanes (A left, B right) so the teal and orange trails never overlap into white.
  Phones (screen < 600 px): no depth of field, no SMAA, smaller blurred mirror, lighter grain.
- `models/heroes.glb` — the landmarks, made in Blender by the owner (1 unit = 10 m): geodesic dome, twisted
  tower, Ferris wheel, in a row (0 / 25 / 50 units along). Loaded with GLTFLoader; the row is turned 90° to
  point north with its gaps stretched 2x: dome (-17, 55), tower (-17, 5), wheel (-17, -45). Each has its own
  size (`PARTS` in `heroes.js`): dome + its platform 1.3x, tower 1.3x wide / 1.5x tall (63 units), wheel 2x.
  Every part is ≥ 16 units (160 m) from the track centre line. Glow levels are toned down in `heroes.js`
  (Blender's 3–5 bleached to white). The twisted tower is the star: its own brighter copies of its materials
  (`TOWER_GLOW`), glass opacity 0.22.
- `models/kit.glb` — the owner's Blender city kit: 6 pieces (Kit_TallTower, Kit_MediumBlock, Kit_WideBlock,
  Kit_CurvyBuilding, Kit_Tree, Kit_LightPost), each a group sitting at its own row spot in the file (reset to
  0,0,0 before use). `city-layout.js` (pure maths, testable in Node, own seed "vegas-kit") places copies at 1.5x
  like a film set, where the cameras look: a fan of buildings BEHIND each trackside corner (seen from its camera),
  rows along both sides of the straights, ~60 trees round them, light posts (0.6x) every 60 m on both road edges.
  Skyscrapers 30–45 units (the twisted tower, 63, stays tallest); none near the tower or dome; nothing between a
  trackside camera and its corner; nothing but posts within 40 m (`CLEAR` = 4 units) of the track, measured to each
  platform/tree edge. `city.js` draws each kit part as ONE InstancedMesh. Glass: opacity 0.5, glow 1.5.
- Bloom: ACES tone mapping, UnrealBloomPass strength 0.8 (phones 0.64; × 0.6 chase, 0.7 trackside), radius 0.6, threshold 0.8 —
  tuned so purple stays purple and gold stays gold. (AgX was tried: it whitened far more.)
- `exports/track.json` — the 3D view's track centre line as `[x, y, z]` points (scene units); remake with
  `node exports/make-track-json.js` after changing the track.
- `track/vegas.js` — the real Las Vegas outline (from pohpingai/f1-news; f1-circuits, MIT).
- `vendor/three/` — a copy of Three.js 0.170 (only the files we use: postprocessing incl. BokehPass + SMAAPass, GLTFLoader + BufferGeometryUtils, Reflector). One change from the npm
  package `three`: in `addons/`, `from 'three'` is rewritten to `from '../../three.module.min.js'`,
  so no "import map" is needed (older iPhones don't support import maps). Redo that when upgrading.

## AI setup (step 2)
- Page → Worker (`https://box-box-brain.pohping-ai.workers.dev/decide`) → OpenRouter → model.
- AI calls are lowercase (`stay_out, push, normal, save, box_soft, box_medium, box_hard`);
  `agents/strategist.js` maps them to the engine's codes (`STAY`, `BOX_SOFT`, …).
- Haiku 5.5 "thinks" before answering by default: the Worker turns that off
  (`reasoning: {enabled: false}`) and enforces the answer shape with a JSON schema.
  With thinking on it used the whole word budget and gave no answer.
- Deploy the Worker with the Cloudflare API, sending `keep_bindings: ["secret_text"]`
  so the owner's secrets survive a redeploy. Since step 3 it is 5 modules:
  `worker/box-box-brain.js` (main_module), `worker/strategist-loop.js`, `sim.js`, `race.js`,
  `agents/bot.js`. Each multipart part needs `filename=<full path>` (e.g. `filename=worker/box-box-brain.js`),
  otherwise Cloudflare says "No such module". Redeploy whenever any of those 5 files change.
- The Worker can't be called from Claude's sandbox (workers.dev is blocked). Test locally:
  import the Worker module in Node, call its `fetch()` with a fake env (OpenRouter auth is
  injected by the proxy; run with `NODE_USE_ENV_PROXY=1`), and route the page's Worker calls
  to it from Playwright.

## Tools (step 3)
- The AI answers through tools only: `simulate(plan)` (max 3 per lap, may be parallel) then `make_call(call, reason)`.
- Worker returns `{ call, reason, cost, sims: [{plan, finishGap}] }`; the radio shows
  "🔧 tested: box_hard now → 2.48s behind · stay_out, box_hard on lap 10 → 6.84s ahead".

## The 9-step ladder
1. **Engine** — race sim, rule bot, Team Boss screen, JSON log.
2. **Strategist agent** — an AI model replaces the rule bot for one team.
3. **simulate() tool** — the agent can test "what if I box now?" before calling.
4. **Team B on another model** — two different AI models race each other.
5. **Engineer** — a second agent per team (tyres/car data) the strategist can ask.
6. **Judge + run 10 races** — an agent scores the calls; batch races for fair comparison.
7. **Memory** — agents remember lessons from past races.
8. **Commentator + voice** — an agent narrates the race out loud.
9. **3D cars** — show the race on a 3D track.
