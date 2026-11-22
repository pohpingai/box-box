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
- `three/` — the 3D Las Vegas night view (step 3.5): `view.js` (puts it together, bloom glow),
  `track3d.js` (outline → 3D points), `ribbon.js` (glowing track), `city.js` (grid, lights,
  buildings), `landmarks.js` (sphere, Ferris wheel), `cars.js` (dots + trails), `labels.js`
  (pop-up words), `drone.js` (camera).
- `track/vegas.js` — the real Las Vegas outline (from pohpingai/f1-news; f1-circuits, MIT).
- `vendor/three/` — a copy of Three.js 0.170 (only the files we use). One change from the npm
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
