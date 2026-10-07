# 05 — Stack, versions and setup

`package.json` is the source of truth for versions. Installed on 2026-10-06:

| Package | Version | Note |
|---|---|---|
| node / pnpm | 26.7 / 11.25 on Lucas's machine | CI uses Node 24 |
| next | 16.3.8 | The same version as CV-AI. APIs differ from model training data: read `node_modules/next/dist/docs/` before using an API from memory |
| react / react-dom | 19.3 | |
| ai | 7.0.x | AI SDK 7: `generateText` + `Output.object` (`generateObject` is deprecated). Check the `.d.ts` before using a remembered API |
| @ai-sdk/groq | 4.0.x | `createGroq`, `groq.tools.browserSearch` |
| @upstash/redis | 1.39 | the deployment store |
| zod | 4.6 | model output schemas |
| vgpu, @vgpu/wgsl, @vgpu/wgsl-std | 0.5.0 | same versions as CV-AI and GraphMan |
| motion | 14 | `motion/react` |
| tailwindcss | 4.3 | tokens in `src/app/globals.css` |
| shadcn (radix-nova) | 4.21 | `components.json` copied from CV-AI; `cn` comes from the `cn` package |
| qrcode.react, nanoid, geist, lucide-react, simple-icons | | QR for the invite, ids and tokens, Geist Mono, interface icons, brand glyphs (GitHub) |
| Inter via `next/font/google` | | The text face; downloaded at build time, so a build needs network access (Next falls back to a system font and warns when it cannot) |
| typescript / eslint | 5.9 / 9 | **Pinned on purpose.** `pnpm add -D typescript eslint` pulled TypeScript 7 and ESLint 10, which CV-AI's toolchain was never tried with |

Not used, despite earlier plans: `@upstash/realtime` (see the decision in `02-architecture.md`), `@ai-sdk/react`, `zustand`, `@upstash/ratelimit`.

## How the scaffold was made

Not with `create-next-app`: the config files were copied from CV-AI (`tsconfig.json`, `postcss.config.mjs`, `components.json`, `pnpm-workspace.yaml`, `vercel.json`, `.gitignore`, `src/wgsl-env.d.ts`, eight `components/ui/*` files) and the dependencies added with `pnpm add`. The i18n provider is GraphMan's. To add a shadcn component: `pnpm dlx shadcn@latest add <name>` (never hand-edit `src/components/ui`).

## Environment variables (`.env.example`)

```
GROQ_API_KEY=                 # https://console.groq.com/keys (free tier). Missing → mock judge
GROQ_JUDGE_MODEL=openai/gpt-oss-120b     # structured judgement + ruling
GROQ_MENTION_MODEL=openai/gpt-oss-20b    # @deb; browser_search exists only on gpt-oss-*
JUDGE_ENGINE=                 # "mock" forces the mock judge even with a key
UPSTASH_REDIS_REST_URL=       # or KV_REST_API_URL, as the Vercel Marketplace integration names it
UPSTASH_REDIS_REST_TOKEN=     # or KV_REST_API_TOKEN. Missing → in-memory store (dev only)
ADMIN_PASSWORD=               # /admin. Missing → "admin" in development, no login in production
```

Two models on purpose: Groq's limits are per model, so the judge and the mention each get their own 8,000 tokens/min and 200,000 tokens/day.

## Commands

```bash
pnpm dev                      # http://localhost:3000, no configuration needed (memory store + mock judge)
pnpm lint · pnpm typecheck · pnpm build      # what CI runs (typecheck = next typegen + tsc)
pnpm judge '<message>' [--locale en|pt]      # one judgement in the terminal, prints tokens used
pnpm mention '<question>' [--reply]          # one @deb call in the terminal
pnpm exec vgpu check src/components/cubes/cubes.wgsl
```

Local walkthrough: `/admin` (password `admin`), create a debate, open its link in two browser windows (or one normal and one private window, since the seat lives in localStorage), join one side in each.

## Deploying (not done yet)

1. Vercel: import `lkzppm/debait`; production tracks `main`.
2. Add Upstash Redis from the Vercel Marketplace (injects the Redis variables).
3. Set `GROQ_API_KEY` and `ADMIN_PASSWORD` for production and preview.
4. First checks on the deployment: the admin panel must say "Upstash Redis" and "Groq"; run one debate between two phones; watch whether the event stream survives its 240-second recycle.

## Lessons inherited from CV-AI (all observed there between 2026-10-03 and 2026-10-06)

- Groq rate limits are **per model**; splitting roles across models multiplies the budget.
- Structured output on Groq is strict: `.nullable()` not `.optional()`, all keys required. Tool inputs coming from gpt-oss may contain `null` for unset fields: accept with `.nullish()`.
- `gpt-oss-20b` failed large schemas and burned its default 2,048 output tokens on reasoning (`finishReason: "length"`, empty text). Set `maxOutputTokens` explicitly and `reasoningEffort: "low"`; check `finishReason` before trusting output.
- Recompute any number in code.
- Give the model a lean view of prior results; give the UI the full object.
- Test without a browser: `tsx scripts/<name>.mts` (the package scripts pass `--env-file-if-exists=.env.local`). Use `.mts` (tsx compiles `.ts` as CJS and rejects top-level `await`).
- Generated folders (`components/ui`) are re-added by CLI, never hand-edited; shadcn stays in radix mode.
- Vercel: `vercel git connect` may fail until the Vercel GitHub app has access to the repo; connect from the dashboard if so. Production tracks `main`.
- Radix collapsibles: never `!important` on the height animation.

## Links

- AI SDK: https://ai-sdk.dev/docs
- Groq models and limits: https://console.groq.com/docs/models · https://console.groq.com/docs/rate-limits · built-in tools: https://console.groq.com/docs/tool-use/built-in-tools
- Upstash Redis: https://upstash.com/docs/redis
- vgpu: https://github.com/vercel-labs/vgpu · examples: https://vgpu.sh/examples
