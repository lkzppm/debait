# Debait

**Debate. Don't take the bait.** A chat room where two people debate a motion while Deb, an AI referee, scores every argument as it lands, shows the math, flags fallacies with the exact words that caused them, and checks facts on the web when a debater calls `@deb`.

A UFRJ course project (2026): "create a chatbot on a theme of your own".

> The meter shows who is **arguing better**, not who is right. Deb judges the form of the argument and never picks a side.

## What makes it different

1. **The score is computed and shown in real time, with the math visible.** Each message gets a ledger entry within seconds: `62 = 78 − 16 (straw man)`. The model only observes (rubric ratings, fallacies, claims); the points, the meter and the winner are computed in code ([`src/lib/debate/scoring.ts`](src/lib/debate/scoring.ts)).
2. **The bot can be summoned.** A debater writes `@deb` to have a claim validated or something searched. The answer arrives in the room with sources, and a validation moves the score of whoever made the claim. Each debater has a few challenges, like calling for a review.

Also: Portuguese and English interface with a switch, a light and a dark theme, no accounts (a link or QR code and a name), prompt-injection attempts are flagged and score zero, and a pixel grid rendered with WebGPU ([vgpu](https://github.com/vercel-labs/vgpu)) whose cells the two sides, neon purple and aqua, fight over behind the chat.

## How it works

```
message ──▶ POST /api/rooms/[id]/messages ──▶ append to the room's event log
                                               └─ after the response: the judge reads it
                                                    └─ appends a judgement event
browsers ◀── GET /api/rooms/[id]/events (Server-Sent Events) ── the log, live
browsers run reduce(room, events) ── the same reducer the server uses ──▶ meter, ledger, turn
```

- A room is an append-only event log. Everything on screen is derived from it by one pure reducer shared by server and browser ([`src/lib/debate/reducer.ts`](src/lib/debate/reducer.ts)), so two phones, a spectator and a projector always agree.
- The judge runs on [Groq](https://groq.com) through the Vercel AI SDK: one structured call per message, one or two calls per `@deb` mention (Groq's built-in `browser_search`), one for the closing ruling. Prompts exist in both languages ([`src/judge/prompts`](src/judge/prompts)).
- Debates are created only on `/create`, behind an admin password; anyone with the code enters on `/join`. `/admin` (same password) lists the debates, stops or deletes them, and shows tokens spent per model against Groq's free-tier limits.

## Run it

Requirements: Node.js 20+ and pnpm.

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

That is enough to use the whole interface: with no configuration the app keeps rooms in memory and judges with a **mock** (keyword heuristics, clearly labelled on screen), so nothing is spent while working on the UI. Open `/admin` (password `admin` in development), create a debate, and open its link in two browser windows.

To use the real judge, copy `.env.example` to `.env.local` and fill in:

| Variable | What it is |
|---|---|
| `GROQ_API_KEY` | Free key from https://console.groq.com/keys. Without it the mock judge is used. |
| `GROQ_JUDGE_MODEL`, `GROQ_MENTION_MODEL` | Default `openai/gpt-oss-120b` and `openai/gpt-oss-20b`. Two models on purpose: Groq's limits are per model. |
| `JUDGE_ENGINE` | Set to `mock` to force the mock judge even with a key. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis. Required on Vercel (serverless instances do not share memory); optional locally. |
| `ADMIN_PASSWORD` | Password for `/create` and `/admin`. Required in production. |

The project runs at https://debait-pi.vercel.app (production tracks `main`; every pull request gets a preview).

Useful commands:

```bash
pnpm judge 'Só um idiota acredita nisso.'     # one judgement in the terminal, with tokens used
pnpm mention '@deb isso é verdade?' --reply   # one @deb call in the terminal
pnpm lint && pnpm typecheck && pnpm build     # what CI runs
```

## Deploy

Import the repository on Vercel, add the Upstash Redis integration from the Marketplace (it injects the Redis variables), and set `GROQ_API_KEY` and `ADMIN_PASSWORD`.

## Limits worth knowing

- An LLM judge can be wrong. Flags below a confidence threshold are hidden, every flag must quote the message verbatim, and sides are anonymous to the model, but biases remain. See [`spec/03-judge.md`](spec/03-judge.md).
- Groq's free tier allows 8,000 tokens per minute and 200,000 per day per model: enough for a few debates a day, not for a crowd.

## For contributors and coding agents

Start at [`spec/README.md`](spec/README.md): the idea, the market research, the architecture, the judge design, the UI and the roadmap. [`CLAUDE.md`](CLAUDE.md) holds the working rules.

## License

MIT
