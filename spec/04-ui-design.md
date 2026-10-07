# 04 — UI and design

Status on 2026-10-06: **second visual direction, revised the same day**. Lucas rejected the first look (near-black glass panels, cyan vs orange, a soft noise shader) as lacking personality, and pointed at https://www.cognee.ai as the reference, with purple and green as the two main colours and the "cubes" rendered with vgpu. After seeing that built he asked for three changes, also on 2026-10-06: a landing page laid out like GraphMan's (the name, one sentence, animated figures that explain, no marketing phrases), a light and a dark theme with better colours, and a livelier cubes background. A third pass the same day (Lucas: "the colour palette and the font are not that great, it is kinda messy"): neon purple vs aqua, Space Grotesk instead of Geist at weight 300, a plain top bar instead of the floating pill, and icons on the buttons. Everything below describes the result; the code in `src/components/` is the current state. **None of the revision was seen running by Claude** (Lucas verifies visual changes himself): it passed typecheck, lint and the shader validator only.

## Design idea

**A page with a thin pixel grid, and two colours fighting for its cells.** Taken from cognee.ai and bent to a debate:

- **The grid and the cubes.** The page background is a grid of square cells with hairline lines. Cells rise out of it as small extruded cubes in drifting clusters: purple on side A's part of the screen, green on side B's, denser where the two meet, where they also capture each other's cells. The frontier sits where the meter is. This is `CubesField`, rendered with vgpu.
- **The mosaic.** A dense band of cells in three or four flat shades of a colour, like the bottom of cognee's cards. The meter is one, split purple/green at the score; cards use it as decoration. This is `CubesBand`, also vgpu.
- **Type.** Inter (`next/font/google`, loaded in `layout.tsx`, with `cv11` and `ss01`) for everything but code; headlines at weight 500 to 600, large and tight; Geist Mono for codes, formulas and the terminal. Geist at weight 300 and then Space Grotesk were both rejected on 2026-10-06 ("messy"), so no `font-light` anywhere and no quirky face. An accent word in italics with a coloured underline (`.headline em`).
- **Square cards, round buttons.** Cards have hairline borders and 4px corners (`--radius: 0.25rem`); buttons and tags are pills (`src/components/site/pill.tsx`), and a button carries an icon whenever there is an obvious one (arrow, plus, sign in, copy, GitHub). The top bar (`site/nav.tsx`) is square: full width, a hairline under it, the page colour behind it; the wordmark on the left, the two doors (Enter, Create) in the middle with the current one underlined in purple, and on the right GitHub and Admin as icon-only buttons, the language and the theme switches. No page title in the bar (Lucas, 2026-10-06). The room's header is the same bar with the motion in it. (A floating pill bar was tried and did not match the cards.)
- **Eyebrows.** Small spaced capitals above titles ("O PROBLEMA", "01 — PLACAR AO VIVO"): the `eyebrow` utility.
- **Marker.** A number or a sentence on a solid block of a side colour with dark text (`.mark-a`, `.mark-b`): the points a message earned, a name, a feature's example.
- **Crooked flags.** What Deb flags appears as red-bordered chips rotated a degree or two, like cognee's "Can't connect" warnings.
- **The terminal.** A call to `@deb` is a terminal window: the debater's line is the command, Deb's answer is the output, the status bar says what it did to the score.
- **The wordmark.** "debait" with the a in side A's colour and the i in side B's, nothing else: no italics, no underline (Lucas, 2026-10-06). `BRAND.wordmark` splits it.
- **Pixel Deb.** The bot's avatar is an 8 by 8 pixel face with three moods and a pink bow in her hair, two loops and a knot over the top-right of the head, as a real hair bow (`src/components/site/deb.tsx`, `--bow`, on no side). She is also the logo mark next to the wordmark (purple left, aqua right) and the favicon (`src/app/icon.svg`, same drawing in fixed colours). On the landing page she is drawn large and live (`hero-mark.tsx`), bow included, one cell in from her right edge. Her cells shade towards `--side-a-shade` / `--side-b-shade`: the page at night, a deep tone on paper (mixing towards white made her patchy, which is why a contour was tried, 2026-10-06). (A contour line around her was tried and removed the same day.) (Lucas, 2026-10-06: "make the icon in the navbar and of the whole project be deb, and put a hair bow on her".)

The two differentiators (`00-overview.md`) keep the most visible real estate: the **ledger** (why the score just moved) and the **`@deb` call**.

## Screens

### Landing `/`

Laid out like GraphMan's (`../GraphMan/web/src/components/Hero.tsx`), with as few words as possible (Lucas, 2026-10-06: "just the name, a brief description and more animated figures explaining").

- **One viewport**: the live mark on the left, and on the right the wordmark, one sentence and the stack as a row of links; the doors are in the bar (the tagline and the two buttons were removed from the hero on 2026-10-06). An arrow points down.
- **The live mark** (`site/hero-mark.tsx`): Deb as a face of cubes, 11 by 10 cells, purple on the left half and green on the right, the middle column changing hands. Cells build in on load and reshuffle their shade; her eyes follow the pointer; she blinks; a click makes her frown and raise a crooked flag with a fallacy and its cost.
- **How it works** (`site/demo.tsx`): one short scripted debate (two messages and a call to `@deb`) shown the ways the room shows it: the chat with the terminal, the ledger with the rubric bars, and the meter (a real `CubesBand`). Six steps; the focus walks them on its own and follows the pointer on the step squares, as GraphMan's `Representations` figure does. The numbers are computed by `scoreMessage` and `meterShare`, not typed in, and the claim checked in it is real (Bloom et al., QJE 2015: 13%).
- **Three facts** under it: fallacies in the taxonomy, rubric criteria, and "0 points given by the AI" (the model observes, the code scores).
- The top bar above it all (`site/nav.tsx`).

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

### Join `/join` and Create `/create`

`/join`: a title, one sentence, and a card with the code as six square cells, three purple and three aqua, filled as you type (one invisible input over them, so paste and phone keyboards work), a one-row mosaic along the top, and the Enter button. `/create`: the password card (Deb, a purple top edge, the field lighting up purple on focus) beside a line saying why (every debate spends the free quota); then the form (coloured left edges on the two stance fields, steppers instead of number spinners). **One room at a time** (Lucas, 2026-10-06): once created, the form is replaced by the room's card (code, motion, the two sides with who took them, format, QR code, link, Copy, Open) with a **Close room** button that stops the debate and brings the form back. The room id is kept in localStorage (`debait.created`) and looked up on reload through `GET /api/admin/rooms`; a room that is finished or gone drops out by itself. Built 2026-10-06 at Lucas's request for pages "more interesting, using the palette, better inputs"; not seen running.

### Admin `/admin`

Functional, not decorated. Password form; then a table of debates (motion, status, seats taken, tokens used, created at) with open / stop / delete, a link to `/create`, and usage bars per model: tokens today of 200,000 and requests today of 1,000, turning amber and red as they fill. Delete asks for confirmation.

## Showing the score in real time (differentiator 1)

- **Bubbles**: each argument is a chat bubble (2026-10-06, Lucas), rounded, tinted in its side's colour at low opacity with a matching hairline, the corner nearest the name kept sharp; the name and round sit above it in small text, the judgement below.
- **Deb's face** next to each score (2026-10-06): a smile at 65 points or more, the flat idle face from 40, a frown with brows under 40, the stern face on a manipulation attempt (`verdictMood` in `site/deb.tsx`).
- **Judgement line** under each message: the formula with numbers (`62 = 78 − 16`), each penalty naming its cause, and the one-sentence note. Tap to expand the four rubric ratings as small bars.
- **Flagged excerpt**: the quoted text is underlined inside the bubble (dashed, warning colour); tap it for the fallacy's name, definition and the bot's explanation. Verbatim-quote matching is the same idea as CV-AI's `CvRef` highlights; if the quote cannot be found, show the chip without the underline.
- **Ledger panel**: newest entry on top, each with seat colour, delta, source (round number or bot call). New entries spring in; the delta visibly travels to the meter.
- **Meter timeline**: removed from the room on 2026-10-06 with the rubric averages, the per-message mock tags, the mock banner and the message numbers (Lucas: "make it less polluted"). The ledger carries the history; `DebateState.history` still exists if a sparkline comes back on the result screen.
- **Pending state**: between a message and its judgement (1 to 2 s) the bubble shows a shimmer "judging…" line, so the wait reads as work, not lag.
- **Manipulation attempt**: a distinct line ("tried to manipulate the bot: 0 points") and a glitch pulse in the cubes.

## Calling the bot (differentiator 2)

- One composer for both moves: text that contains `@deb` goes to the bot (any time), anything else is an argument (needs the turn). An `@` button next to the field inserts the mention; the `@deb` chip under a check-worthy message starts a call about that message. An autocomplete on typing `@`, and a reply action on every message, are not built.
- The mention appears in the chat as the debater's message with the reply target shown; right below, the bot's card starts as "searching…" and resolves to: the status for a validation (confirmed / imprecise / false / unverifiable), a short explanation, sources as links, and the score effect if any.
- Remaining challenges show as dots near the composer; when none are left the mention still works for `explain`.
- Claims the judge marked check-worthy carry a subtle "can be challenged" hint, teaching the feature without a tutorial.

## Palette and themes (tokens in `src/app/globals.css`)

Brazil-specific constraint, still valid: **never red vs blue or green/yellow vs red** for the two sides; those pairs read as political parties. The pair chosen on 2026-10-06 (third pass) is **neon purple vs aqua**: the earlier lavender vs mint and violet vs green were both rejected.

Two themes (Lucas, 2026-10-06): **paper** (`:root`) and **night** (`.dark` on `<html>`). A script in `<head>` sets the class before the first paint from the stored choice, or from the system preference the first time; `src/lib/use-theme.ts` holds the store and `site/theme-switch.tsx` the button, which sits next to the language switch on every screen.

| Token | Paper | Night | Use |
|---|---|---|---|
| `--side-a` / `--side-a-deep` | `#9B3DFF` / `#7F22E0` | `#B44DFF` / `#9A2BF0` | side A, neon purple, and the app's accent (primary buttons, eyebrows, links) |
| `--side-b` / `--side-b-deep` | `#0AA896` / `#088C7D` | `#2EE6D6` / `#12C4B4` | side B, aqua (a brighter teal on paper, Lucas's choice over a darker one that passed as text) |
| `--ink` | `#FFFFFF` | `#07060E` | text on top of either side colour and on `--bot` |
| `--background` / `--card` / `--popover` | `#F6F5FB` / `#FFFFFF` / `#FFFFFF` | `#07060E` / `#100E1C` / `#0C0A17` | page, cards, the top bar and terminal chrome |
| `--foreground` / `--muted-foreground` | `#121020` / `#5F5B72` | `#ECEAF6` / `#9893AD` | text |
| `--border` / `--input` | foreground at 12% / 24% | foreground at 12% / 20% | hairlines |
| `--destructive` / `--warning` | `#D9304A` / `#9A5B00` | `#FF5C7A` / `#FFC957` | fallacy flags and "false"; "imprecise" and the mock notice |

- Components use the tokens (`bg-card`, `text-side-a`, `var(--side-a)`), never a hex value, so both themes follow.
- The cubes shader reads `--side-a`, `--side-b`, `--background` and `--foreground` at runtime and parses them as 6-digit hex: keep those four in that form.
- Because green is a side, it is never used to mean "good": a confirmed fact-check is a neutral tag with a check mark, and "live" in the admin table is purple.
- Never encode a side by colour alone: always pair it with the name, the "Lado A / Lado B" label and the left/right position.
- Contrast was estimated by arithmetic, not measured on a screen: on paper the side colours are darker so they pass as text (purple about 4.7:1; the teal is about 3.4:1, under the 4.5:1 text guideline, chosen for brightness).

## vgpu: the cubes (`src/components/cubes/`)

`cubes-canvas.tsx` exports the two components; `cubes.ts` owns the GPU; `cubes.wgsl` is the shader. Both components take the meter's state: `share`, `pulse` + `pulseDir` (a counter that fires an impact when the score changes), `glitch` (a counter that fires on a fallacy or a manipulation attempt), `provisional`, `intensity`.

- **`CubesField`**: the page background, composited over the theme's background colour. Grid lines; clusters of cells rising as small extruded cubes (a lifted face, two shaded walls, a lit edge); a jagged frontier at `share` where cells are redrawn every few seconds and flash when they change hands; a dithered (Bayer) glow of each side on the ground; a slow diagonal sweep of light; cells waking under the pointer with rings leaving it, and a wider ring on a click; a wave on impact; scattered flashes on glitch. One pass, two noise lookups per pixel. Kept deliberately faint: Lucas found the first version unreadable behind text (2026-10-06), so clusters are sparse away from the frontier, the dither is near-invisible (on paper the cubes and the dither are pushed about 1.7x harder, since a faint tint washes out on white) and the landing page runs it at `intensity` 0.45 with a feathered patch of page colour behind the words.
- **`CubesBand`**: fills its container with a mosaic `rows` cells tall, shades mixed between the page and the side colour, with a straight frontier so it reads as an exact meter; `tone="neutral"` gives the grey version.
- Without WebGPU, on init failure, or under `prefers-reduced-motion`, both fall back to static versions drawn with CSS variables, without the GPU. The band's fallback matters most: it is the meter.
- The palette comes from the CSS custom properties and the `dark` class on `<html>`; one `MutationObserver` re-reads them when the theme flips. A feedback pass and bloom were considered and left out: they could not be checked without running the page.
- Rules carried from CV-AI: shaders are `.wgsl` files imported through the `@vgpu/wgsl` loader (Turbopack rule in `next.config.ts`, types in `src/wgsl-env.d.ts`); validate with `pnpm exec vgpu check src/components/cubes/cubes.wgsl` (CI does); dynamic-import the GPU module on the client only.
- The DOM meter is the source of truth for reading the score: `role="meter"` with `aria-valuenow` and the two percentages. No line is drawn over the mosaic (a frontier line and a halfway mark were removed on 2026-10-06, Lucas: "let just the green/purple effects"); the band's straight frontier is the only picture of the share.

See `06-roadmap.md` for whether the shader has been seen running in a WebGPU browser.

## Motion (motion v14, `motion/react`)

- Messages: short fade and rise; the judgement line springs in after the bubble.
- Meter: spring on the frontier line; the percentage numbers tick; the mosaic reacts through its pulse.
- Result: one orchestrated sequence, the only "big" animation in the app.
- Respect `prefers-reduced-motion` throughout.

## Languages in the UI

- A switch in the header (pt / en), Portuguese by default, GraphMan's `LocaleProvider` pattern (`02-architecture.md`). Every visible string comes from `src/i18n/`.
- Fallacy names, rubric labels, statuses and ledger labels follow the **viewer's** language. The bot's free text (notes, explanations, answers) stays in the **room's** language; if the two differ, that is expected and needs no warning.
- GraphMan's rule carries over: no em dash in anything the visitor reads; use a comma, a colon or a full stop.

## Voice

Direct, a little playful; Deb is firm and never mocks a debater. The landing eyebrow is the pun: "Debata. Não morda a isca." Explanations teach: name the fallacy, quote it, say what a valid version of the argument would look like.

Suggested demo motions (playful or technical on purpose, so a classroom demo does not turn into a party-politics fight): "Biscoito ou bolacha: biscoito é o certo", "Home office é melhor que presencial", "IA vai substituir programadores juniores", "Prova com consulta ensina mais que prova sem consulta". Pick one with checkable facts, so the `@bot` validation has something to find.
