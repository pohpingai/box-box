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
- Update `PROGRESS.md` at the end of each step.

## Files
- `race.js` — race engine: tyres, modes, pit stops, surprises, lap log.
- `agents/bot.js` — the rule bot brain (if/then checklist).
- `ui.js`, `index.html`, `style.css` — the Team Boss screen.

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
