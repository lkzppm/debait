# 02 — Architecture

Status on 2026-10-06: **scaffold built**. Everything in this file exists in the repo and passed lint, typecheck, build and a scripted end-to-end run on the mock judge with the in-memory store. Not yet run: the Groq engine, the Upstash driver, a Vercel deployment. Those are marked Unverified where they matter.

## Stack

| Layer | Technology | Why |
|---|---|---|
| Framework | Next.js 16 (App Router, Turbopack, React 19) | Same as CV-AI; route handlers for the API; deploys to Vercel with zero config |
| LLM | Groq via `@ai-sdk/groq`, `openai/gpt-oss-120b` and `-20b`, free tier | Required by the assignment; a judge that answers in 1 to 2 s keeps the score live; strict structured output; built-in `browser_search` for `@deb` |
| AI SDK | Vercel AI SDK 7 (`ai`) | `generateText` with `Output.object` and zod schemas (`generateObject` is deprecated in v7) |
| Storage | A small `KV` interface with two drivers: **Upstash Redis** (`@upstash/redis`) and **in-process memory** | Upstash for deployments (serverless instances share nothing); memory so `pnpm dev` needs no account |
| Realtime | **Server-Sent Events from our own route**, reading the room's event log from the store | No extra service; `EventSource` reconnects and resumes by itself (see below) |
| Judge fallback | A **mock engine** behind the same interface as Groq | The whole UI works with no API key and spends no quota; clearly labelled on screen |
| UI | Tailwind v4 + shadcn/ui (radix mode) | Same toolchain as CV-AI |
| Visual | **vgpu** (WebGPU) + motion | The cubes: a pixel grid behind the page and the meter as a mosaic, with non-GPU fallbacks (`04-ui-design.md`) |
| i18n | Typed dictionaries, no library | GraphMan's pattern |

## Core idea: an event log, one reducer, a ledger

A room is an append-only list of events. Everything on screen is **derived** by a pure function:

```ts
// src/lib/debate/reducer.ts — imported by server AND browser
reduce(room: RoomMeta, events: DebateEvent[]): DebateState
```

- The **ledger** is the first differentiator made concrete: one entry per score change (`judgement` or `validation`), with the seat, the delta and the meter position after it. `DebateState.history` is the meter after each entry, drawn as the timeline.
- The server runs the reducer to validate a move ("is it this seat's turn?", "any challenges left?") and to name the winner. The browser runs it to render. A refreshed tab, a spectator and the projector reach the same state from the same log.
- All arithmetic is in `src/lib/debate/scoring.ts` (see `03-judge.md`). The model only produces observations, and `normalizeJudgement` / `normalizeReply` clamp whatever it returns before it enters the log.

## Storage

`src/lib/store/`: `kv.ts` (the interface: get/set, set-if-absent, lists, hashes, a sorted set), `upstash.ts`, `memory.ts`, `index.ts` (picks Upstash when `UPSTASH_REDIS_REST_URL` + `_TOKEN` or the Marketplace's `KV_REST_API_URL` + `_TOKEN` are set, memory otherwise).

- The memory driver lives on `globalThis` so every route handler and hot reload of the dev server shares it. It is lost on restart and **must not be used on Vercel**; the admin panel shows which driver is active.
- The Upstash driver is written against the client's typings and has never run (Unverified). First thing to check when credentials exist: create a room, join, post.

Keys (7-day TTL; the admin deletes rooms explicitly):

| Key | Type | Content |
|---|---|---|
| `room:{id}` | JSON | `RoomRecord`: motion, stances, `locale` (the language the bot writes in), format (rounds, char limit, challenges), `createdAt`, and `status` mirrored from the log for listings |
| `room:{id}:seats` | hash | seat → `{ name, tokenHash }` (claimed atomically with HSETNX) |
| `room:{id}:events` | list | the event log; an event's `seq` is its index |
| `room:{id}:usage`, `usage:{YYYY-MM-DD}` | hash | tokens and requests per model |
| `rooms` | sorted set | room ids by creation time, for the admin list |
| `room:{id}:turn:{n}`, `:ask:{n}`, `:judging:…`, `:answering:…`, `:start`, `:finish` | string (set-if-absent) | guards so a turn, a call, a judgement or the ending happens once |

Room id: 6 lowercase letters without `i`, `l`, `o`. Letters only on purpose: the Upstash client parses anything that looks like a number or JSON.

## Events (`src/lib/debate/types.ts`)

| Event | Emitted when |
|---|---|
| `room.joined` | a seat is taken (seat, name) |
| `room.started` | both seats are taken |
| `debate.message` | a debater posts an argument |
| `debate.judgement` / `debate.judgement_failed` | the judge finished, or gave up, on a message |
| `bot.asked` | a debater mentions the bot (text, `replyTo`) |
| `bot.replied` / `bot.failed` | the bot answered, or could not |
| `room.finished` | the last message was judged (`completed`) or the admin stopped it (`stopped`) |
| `debate.ruling` | the closing text; the winner comes from the reducer, not from the model |

Events carry ids and numbers, never translated labels. Failure events carry a code (`failed`, `budget`), not provider messages.

## Request flows

```
GET  /api/rooms/[id]/events          the event log as Server-Sent Events (history, then live)
POST /api/rooms/[id]/join            take a seat → { seat, token }
POST /api/rooms/[id]/messages        post an argument (needs the turn)
POST /api/rooms/[id]/mention         call the bot (any time while live)
POST /api/rooms/[id]/judge           retry a failed or lost judgement

POST   /api/admin/login              password → session cookie   (DELETE signs out)
GET    /api/admin/rooms              rooms, usage, engine and store in one payload (the panel polls it)
POST   /api/admin/rooms              create a debate
POST   /api/admin/rooms/[id]/stop    end it now
DELETE /api/admin/rooms/[id]         delete room, log and usage
```

Each move has two halves (`src/lib/debate/run.ts`): a fast one that validates and appends to the log, after which the route responds, and a slow one that calls the model and appends the outcome, scheduled with `after()` from `next/server`.

```
POST messages {token, text} ─▶ postMessage: seat, turn (atomic guard), length ─▶ append debate.message ─▶ 200
                               after(): runJudgement ─▶ engine.judgeMessage ─▶ normalize ─▶ append debate.judgement
                                        └─ finishIfComplete ─▶ room.finished ─▶ engine.writeRuling ─▶ debate.ruling

POST mention {token, text, replyTo?} ─▶ postMention: seat, not busy, calls left ─▶ append bot.asked ─▶ 200
                                        after(): runMention ─▶ engine.answerMention ─▶ normalize ─▶ append bot.replied
```

- A message that mentions the bot is refused as an argument (`is_mention`); the composer routes by the same rule (`mentionsBot` in `src/lib/brand.ts`).
- A judgement or a call with no outcome after 90 s (`STALE_MS`) is treated as lost: the judgement can be retried, and the bot accepts a new call.
- `after()` worked in the local run. On Vercel it lives inside the route's `maxDuration` (60 s for messages, 120 s for mentions): Unverified there.

## Realtime: SSE over the log

`GET /api/rooms/[id]/events` streams every event from the start, each with `id: <seq>`, then a `ready` event, then keeps polling the store (200 ms on memory, 600 ms on Upstash) and pushing what is new. It ends itself after 240 s, under its `maxDuration` of 300 s.

- The browser hook (`src/lib/use-room-events.ts`) uses `EventSource`. When the stream ends or the network drops, the browser reconnects and sends `Last-Event-ID`; the route resumes from the next event. History and live updates take the same path, so there is no snapshot endpoint and no gap to handle.
- The hook accepts an event only when its `seq` is exactly the next one, so repeats are harmless.
- A deleted room sends a `gone` event (or a 404 on connect) and the page says so.
- Cost on Upstash: about two commands per second per open tab. Fine for a class; watch the free quota if many spectators connect (limits not checked).

## The admin pages

Three pages (Lucas, 2026-10-06: "a homepage, a page to create rooms and another to enter, creating only with the admin password"): `/join` is public and only turns a code into `/r/{id}`; `/create` shows the password form until the cookie is set, then the creation form (`components/admin/create-form.tsx`); `/admin` is the panel for what runs and what it spends. Both protected pages are guarded by `ADMIN_PASSWORD` (`src/lib/admin.ts`). Signing in sets an httpOnly cookie derived from the password with HMAC, compared in constant time; changing the password signs everyone out. With no password set, development falls back to `admin` and production refuses every login.

`/create` is the only way to create a debate; the panel can stop or delete one. It shows which judge engine and which store are active, and **spending**: tokens and requests today per model against Groq's free-tier limits (`src/lib/usage.ts`), plus tokens per debate. Every model call goes through `checkBudget` (refuses at 90% of the daily tokens) and `addUsage`. "Today" is a UTC calendar day; Groq's window may be rolling.

## Identity and trust

- No accounts. Joining returns a random seat token; the server keeps only its hash; the browser keeps the token in localStorage per room (`src/lib/identity.ts`) and sends it with every move.
- Whoever opens a room without a seat is a read-only spectator. That is also the projector view.
- Seat, round and scores are never accepted from a request body. Debater text is data in every prompt.
- The model can only be reached with a seat token of an existing room, inside the turn order and the call cap. No other rate limiting exists.

## Languages

- **Interface language, per viewer**: `src/i18n/` (`en.tsx` is the schema, `pt.tsx` is typed as `typeof en`, Portuguese is the default, `LocaleProvider` + `useT()`, choice kept in localStorage). No visible string inline in a component.
- **Bot language, per room**: `room.locale`, chosen at creation, because what the bot writes goes into the shared log. Prompts exist in both languages (`src/judge/prompts/`).
- Fallacy names and definitions (`src/i18n/fallacies.ts`) feed both the prompt and the tooltips.

## Folder tree

```
src/
  app/
    layout.tsx · not-found.tsx · globals.css · icon.svg
    (site)/                        layout (the top bar) · template (fade-in on navigation) · page.tsx
    r/[id]/page.tsx                room (server: loads the room, 404 if missing)
    (site)/create/page.tsx         login, then the creation form (admin password)
    (site)/join/page.tsx           enter a room by its code
    (site)/admin/page.tsx          login or panel
    api/rooms/[id]/{events,join,messages,mention,judge}/route.ts
    api/admin/{login,rooms,rooms/[id],rooms/[id]/stop}/route.ts
  judge/
    index.ts                       getEngine(), engineInfo()
    types.ts                       the engine contract (JudgeEngine and its inputs)
    groq.ts · mock.ts              the two engines
    schema.ts · models.ts · errors.ts
    prompts/{en,pt,shared,index}.ts
  lib/
    brand.ts                       project and bot names, mention detection
    debate/{types,scoring,reducer,quote,limits,run}.ts
    store/{kv,memory,upstash,index}.ts
    rooms.ts · usage.ts · admin.ts · http.ts          (server)
    api.ts · identity.ts · use-room-events.ts · use-origin.ts · use-theme.ts   (browser)
  i18n/                            index.ts · locales.ts · fallacies.ts · en.tsx · pt.tsx · LocaleProvider.tsx
  components/
    cubes/                         cubes.wgsl · cubes.ts · cubes-canvas.tsx   (the vgpu grid and mosaics)
    room/                          room · lobby · meter · message-item · ask-item · composer · score-panel · result
    admin/                         admin (the panel) · login · create-form
    site/                          home · join · create · nav · hero-mark · demo · logo · brand-icon · deb · pill · locale-switch · theme-switch · copy-button · not-found
    ui/                            shadcn components (generated; re-add with the CLI)
scripts/                           judge.mts · mention.mts · sample.mts
```

## Decisions log

- **2026-10-06 — Turn-based rounds, not free chat.** Fair, naturally throttles model calls, and lets the bot score "did you answer the opponent's last point".
- **2026-10-06 — Event log + shared reducer + ledger.** One code path for refreshes, spectators and the projector; scoring is testable without a browser or a model.
- **2026-10-06 — Our own SSE over the store, instead of Upstash Realtime** (which the first version of this spec proposed). Reasons: it could not be tried without credentials, it would have made local development depend on an account, and with an append-only log the standard `EventSource` + `Last-Event-ID` already gives history, resume and reconnection in about sixty lines. Revisit only if polling the store proves too slow or too costly.
- **2026-10-06 — A memory store and a mock judge**, so the interface can be developed with no accounts and no quota. Both are labelled wherever they show.
- **2026-10-06 — Fact-checking is on demand through `@deb`**, not automatic on every message.
- **2026-10-06 — Admin-only creation with usage tracking** (Lucas), instead of public rooms with rate limits.
- **2026-10-06 — Codebase in English; UI per viewer and bot per room in en / pt-BR** (Lucas).
- **2026-10-06 — Deferred to after Friday**: a dedicated stage view, audience voting, a solo AI opponent, automatic fact-check.
