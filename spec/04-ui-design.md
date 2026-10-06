# 04 — UI and design

Status on 2026-10-06: **first version of every screen is built** (landing, lobby, debate, result, admin) and was looked at in headless Chromium at desktop and phone widths, on the mock judge. Not done: real phones, a browser with WebGPU (the arena was only seen as its CSS fallback), contrast and colour-blind checks. Lucas refines the interface from here; this file is the intent, the code in `src/components/` is the current state.

## Design idea

**The debate is a tug of war and the whole screen is the rope.** Behind the chat, a WebGPU field shows two colours pressing against each other; the frontier sits where the meter is. A legible meter bar with numbers sits on top for reading and accessibility. Everything else stays quiet so the two colours and the live score carry the drama.

The two differentiators (`00-overview.md`) get the most visible real estate: the **ledger** (why the score just moved) and the **`@bot` call**.

## Screens

### Landing `/`

What the project is in one sentence, how the scoring works in three short points, and a field to enter a room code. There is no public "create" button: debates come from the admin panel. The arena runs behind at 50/50, drifting slowly. Language switch in the header.

### Room `/r/[id]`

Three states in one page.

- **Lobby**: the motion, a name field, the two sides with a join button each, a share block (room code, link, QR code). The debate starts as soon as both seats are taken (a countdown is not built).
- **Debate**:

```
┌ motion ──────────────────────────────── round 2/3 · Ana's turn ┐
│ Ana (for)  54% ██████████████▓░░░░░░░░░░░ 46%  Bia (against)   │
│            ▁▂▃▅▄▅▆  meter timeline                             │
├────────────────────────────────────────────────┬───────────────┤
│ [A] message bubble, flagged excerpt underlined │ Ledger (live) │
│     ⚖ 62 = 78 − 16 (straw man) · one-line note │ +62 Ana  r2   │
│                     message bubble [B]         │ −20 Bia  VAR  │
│     ⚖ 71 = 71 · note · "can be challenged"     │ +71 Bia  r1   │
│ [A] @bot is that true?  ↳ replying to Bia      │ +58 Ana  r1   │
│     ⚖ bot: False. … sources ▸   −20 to Bia     │───────────────│
│                                                │ Rubric avg    │
│                                                │ Challenges ●●○│
├────────────────────────────────────────────────┴───────────────┤
│ composer: your turn (0/600) · "@" opens the bot mention         │
└─────────────────────────────────────────────────────────────────┘
```

- **Result**: the meter settles; winner or draw; the full ledger; the bot's short ruling; fallacy and validation tally.

Spectators (anyone who opens a full room) see the same page without the composer. **The projector view is just this**: open the room link on the laptop. Design the debate state so it reads from the back of a room at large zoom: the meter and the latest ledger entry must be the biggest things on screen.

Below `lg` the score panel becomes a second tab (Debate / Score) and the layout is one column; the room must work on two phones, that is the main use. Carry over CV-AI's mobile lessons (`../CV-AI/spec/03-ui-design.md`, "Layout em telas pequenas"): 16px inputs so iOS Safari does not zoom, `interactiveWidget: "resizes-content"`, no full-screen `backdrop-filter` over the animated background on phones.

### Admin `/admin`

Functional, not decorated. Password form; then a table of debates (motion, status, seats taken, tokens used, created at) with open / stop / delete; a create form (motion, the two stance labels, bot language, rounds, challenges per debater) that returns the link and QR; and usage bars per model: tokens today of 200,000 and requests today of 1,000, turning amber and red as they fill. Delete asks for confirmation.

## Showing the score in real time (differentiator 1)

- **Judgement line** under each message: the formula with numbers (`62 = 78 − 16`), each penalty naming its cause, and the one-sentence note. Tap to expand the four rubric ratings as small bars.
- **Flagged excerpt**: the quoted text is underlined inside the bubble (dashed, warning colour); tap it for the fallacy's name, definition and the bot's explanation. Verbatim-quote matching is the same idea as CV-AI's `CvRef` highlights; if the quote cannot be found, show the chip without the underline.
- **Ledger panel**: newest entry on top, each with seat colour, delta, source (round number or bot call). New entries spring in; the delta visibly travels to the meter.
- **Meter timeline**: a sparkline of the meter position after each ledger entry, zoomed on the range the debate actually used, so the room sees the story of the debate, not only the current state.
- **Pending state**: between a message and its judgement (1 to 2 s) the bubble shows a shimmer "judging…" line, so the wait reads as work, not lag.
- **Manipulation attempt**: a distinct line ("tried to manipulate the bot: 0 points") and a glitch pulse in the arena.

## Calling the bot (differentiator 2)

- One composer for both moves: text that contains `@deb` goes to the bot (any time), anything else is an argument (needs the turn). An `@` button next to the field inserts the mention; the `@deb` chip under a check-worthy message starts a call about that message. An autocomplete on typing `@`, and a reply action on every message, are not built.
- The mention appears in the chat as the debater's message with the reply target shown; right below, the bot's card starts as "searching…" and resolves to: the status for a validation (confirmed / imprecise / false / unverifiable), a short explanation, sources as links, and the score effect if any.
- Remaining challenges show as dots near the composer; when none are left the mention still works for `explain`.
- Claims the judge marked check-worthy carry a subtle "can be challenged" hint, teaching the feature without a tutorial.

## Palette (Proposed)

Brazil-specific constraint: **do not use red vs blue or green/yellow vs red**; those pairs read as political parties. Use a pair with no partisan meaning that also survives colour blindness (differs in lightness, not only hue).

| Token | Value (dark) | Use |
|---|---|---|
| `--side-a` | `#38BDF8` (cyan) | side A: bubbles, meter left, arena left |
| `--side-b` | `#FB923C` (orange) | side B: bubbles, meter right, arena right |
| `--bot` | `#E8E6F0` on `#1B1A22` | the bot's lines and cards: neutral, belongs to neither side |
| `--background` | `#0B0B10` | near-black so both colours glow |
| `--warning` / `--destructive` / `--success` | `#FACC15` / `#F43F5E` / `#34D399` | fallacy, false, confirmed |

Dark only for Friday (it lives on a projector). Never encode a side by colour alone: always pair with the name, the stance label and left/right position.

## vgpu: the "arena" shader

One full-screen fragment effect, same lifecycle as CV-AI's background (`../CV-AI/src/components/ambient/papers/papers.ts`): `init()` → `surface(gpu, canvas, { dpr: [1, 2] })` → `effect(gpu, shader, { set: { params } })` → `await fx.compile({ colors: [surface.format] })` → `frameLoop(gpu, frame => { fx.set(...); frame.pass(surface, fx) })`. Dispose on unmount, skip frames when `document.hidden`.

Uniforms:

| Uniform | Meaning |
|---|---|
| `time`, `texel` | animation clock, 1/resolution |
| `share` | eased meter value 0..1; the frontier's x position (ease in TS, about 0.05 per frame, never jump) |
| `impact` | pulse fired on each ledger entry, decays in about a second; sign says which side gained |
| `glitch` | 0..1 pulse on a fallacy or manipulation flag |
| `tension` | how close the score is; drives turbulence at the frontier |
| `provisional` | 1 while the round is incomplete: frontier rendered softer |
| `color_a`, `color_b` | from the CSS tokens |

Look: two domain-warped noise fields (`@vgpu/wgsl-std/noise`), one per colour, meeting at a frontier displaced by noise; a thin bright seam where they touch; the gaining side surges on `impact`. Keep ink low behind text (opacity and a vignette) so bubbles stay readable.

Rules carried from CV-AI: shaders are `.wgsl` files imported through the `@vgpu/wgsl` loader (Turbopack rule in `next.config.ts`, types in `src/wgsl-env.d.ts`); validate with `npx vgpu check <file>`; `fwidth` needs uniform control flow; dynamic-import the module on the client only; do not start when `prefers-reduced-motion` is set; on missing WebGPU or init failure fall back to CSS (two radial gradients positioned by a `--share` custom property). The DOM meter is the source of truth for reading the score: `role="meter"` with `aria-valuenow` and a text label.

As built (`src/components/arena/`): the shader passes `vgpu check`, mixes the two colours in linear light, uses `simplex3d` / `fbmSimplex3d` from `@vgpu/wgsl-std` (about 13 noise samples per pixel), and eases every uniform in TypeScript. **It has never been seen running**: check it in Chrome first, and if it is slow on phones cut the fBM octaves in `side_field` from 3 to 2. `prefers-reduced-motion` and missing WebGPU both get the CSS fallback (two radial glows and a seam that follow the share).

## Motion (motion v14, `motion/react`)

- Messages: short fade and rise; the judgement line springs in after the bubble.
- Meter: spring on the frontier; the percentage numbers tick.
- Score deltas travel from the judgement line to the meter.
- Result: one orchestrated sequence, the only "big" animation in the app.
- Respect `prefers-reduced-motion` throughout.

## Languages in the UI

- A switch in the header (pt / en), Portuguese by default, GraphMan's `LocaleProvider` pattern (`02-architecture.md`). Every visible string comes from `src/i18n/`.
- Fallacy names, rubric labels, statuses and ledger labels follow the **viewer's** language. The bot's free text (notes, explanations, answers) stays in the **room's** language; if the two differ, that is expected and needs no warning.
- GraphMan's rule carries over: no em dash in anything the visitor reads; use a comma, a colon or a full stop.

## Voice

Direct, a little playful; the bot is firm and never mocks a debater. Explanations teach: name the fallacy, quote it, say what a valid version of the argument would look like.

Suggested demo motions (playful or technical on purpose, so a classroom demo does not turn into a party-politics fight): "Biscoito ou bolacha: biscoito é o certo", "Home office é melhor que presencial", "IA vai substituir programadores juniores", "Prova com consulta ensina mais que prova sem consulta". Pick one with checkable facts, so the `@bot` validation has something to find.
