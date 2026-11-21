# box-box-brain (the Cloudflare Worker)

The middleman between the Box Box page and the AI. It holds the OpenRouter key
so the public website never does.

- Address: https://box-box-brain.pohping-ai.workers.dev
- One route: `POST /decide` with `{ passcode, state, rules }` → `{ call, reason, cost }`
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
Edit `box-box-brain.js`, then either ask Claude to redeploy it, or in the Cloudflare
dashboard: Workers & Pages → box-box-brain → Edit code → paste the file → Deploy.
