# box-box-brain (the Cloudflare Worker)

The middleman between the Box Box page and the AI. It holds the OpenRouter key
so the public website never does.

- Address: https://box-box-brain.pohping-ai.workers.dev
- One route: `POST /decide` with `{ passcode, state, rules }` → `{ call, reason, cost, sims }`
- Each lap the AI may run `simulate(call)` ("what if I box now?") before its final `make_call`
  (see `strategist-loop.js` and `../sim.js`). The Worker carries the race engine for this.
- Model: `anthropic/claude-haiku-5.5` via OpenRouter (thinking turned off, answer shape enforced)
- Only accepts requests from `https://pohpingai.github.io`
- Stops at **$0.20 per day** (OpenRouter's count for this key, UTC day)
- Reads its instructions from `prompts/strategist.md` on the live site (refreshed every minute),
  so editing that file on GitHub changes the strategist without redeploying.

## Secrets (added by hand, never in code)
| Name | What |
|---|---|
| `OPENROUTER_KEY` | your OpenRouter API key |
| `PASSCODE` | the word you type into the "AI passcode" box on the page |

Redeploying the code keeps these secrets.

## Changing the Worker code
The Worker is made of 5 files: `worker/box-box-brain.js`, `worker/strategist-loop.js`,
`sim.js`, `race.js`, `agents/bot.js`. After changing any of them, ask Claude to redeploy
(pasting into the Cloudflare dashboard no longer works well now that it is several files).
