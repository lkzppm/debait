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

- **One viewport**: the live mark on the left, and on the right the wordmark, one sentence and the stack as a row of links, each with its mark (simple-icons for Next.js, WebGPU and Vercel; a chip icon for Groq, which simple-icons lacks); the doors are in the bar (the tagline and the two buttons were removed from the hero on 2026-10-06). An arrow points down.
- **The live mark** (`site/hero-mark.tsx`): Deb as a face of cubes, 11 by 10 cells, side A's colour on the left half and side B's on the right, the middle column changing hands. Cells build in on load and reshuffle their shade; her eyes follow the pointer; she blinks; a click makes her frown and raise a crooked flag with a fallacy and its cost.
- **How a Debait works** (`site/demo.tsx`, rebuilt 2026-10-07): one short scripted debate (two messages and a call to `@deb`) played with the room's own components, `MessageItem`, `AskItem`, `Meter` and `ScorePanel`. The script is an event log; each of the six steps is a longer prefix of it run through `reduce()`, so every number is the scoring code's, and the claim checked in it is real (Bloom et al., QJE 2015: 13%). The figure has a fixed height: an invisible copy of the last step sits under the current one in the same grid cell (`Settled`), and the captions are stacked the same way. For the same reason the meter's "provisional" label now sits on the band instead of under it, in the room too.
- **Three facts** under it: fallacies in the taxonomy, rubric criteria, and "0 points given by the AI" (the model observes, the code scores).
- **Footer** (`site/footer.tsx`, 2026-10-07): GraphMan's layout. Four columns hang from a hairline rail, each by a square pixel cell (blue for the first two, red for the last two, like the meter) that lights up on hover: Project (source, enter, create, admin), Stack, Author (Lucas Pacheco, GitHub, LinkedIn, from `BRAND.author`), Course (EEL874 · Inteligência Artificial, UFRJ · 2026/2). The wordmark and the year sit centred under a second hairline. Two columns by two on a phone, where only the first row keeps its cells.
- The top bar above it all (`site/nav.tsx`).

### Room `/r/[id]`

Three states in one page.

- **Lobby**: the motion, a name field, the two sides with a join button each, a share block (room code, link, QR code). The debate starts as soon as both seats are taken (a countdown is not built).
- **Debate** (as built 2026-10-06, Lucas's pass of the same evening):

```
┌ motion ─── round 2/3 · live ─── [Balanced] [Result] [Ledger 4] PT/EN ☀ ┐
│ Ana (for)  54% ██████████████▓░░░░░░░░░░░ 46%  Bia (against)          │
├───────────────────────────────────────────────────────────────────────┤
│ Ana · round 1                                                         │
│ ╭ message bubble, flagged excerpt underlined ╮                        │
│ ☺ ╭ +62 = 78 − 16 [straw man −16] ▾ · one-line note ╮   ← Deb bubble │
│                                 Bia · round 1                         │
│                        ╭ message bubble ╮                             │
│                  (↩) Deb bubble ╭ +71 · note ╮ ☺   ← arrow: ask Deb │
│ Ana · called Deb                                                      │
│ ╭ @deb is that true? ╶ about Bia's message ╮      ← dashed bubble     │
│ ☺ ╭ FACT CHECK · FALSE · text · [1] source · −20 for Bia ╮           │
├───────────────────────────────────────────────────────────────────────┤
│ (fades out)                                                   (i) Deb │
│ composer: your turn                                        0/600 [↑] │
└───────────────────────────────────────────────────────────────────────┘
```

Everything from Deb is a chat bubble of her own, under the message it answers and on the same side, with her face as the avatar (good, medium or bad by the points; stern on manipulation). A call to `@deb` is two bubbles on the caller's side: the request (dashed border, the handle highlighted) and the answer. The **ledger** ("Extrato", `room/score-panel.tsx`) groups the score changes by round, newest first, with each side's subtotal in the round's header; every line has an icon tile in the side's colour (Deb's verdict face for an argument, the ruling's icon for a fact check, a shield for manipulation), the name and what happened, and the points; the challenges left are `@` glyphs. It and the **result** are popups (`site/dialog.tsx`, Radix Dialog with a motion fade); the result opens by itself when the debate ends and again when the written ruling lands. The composer has no `@` button.

Chat pass (2026-10-07, Lucas: "too generic", "too polluted"): the ledger opens from a round floating button at the chat's top right, and Deb's help from an info button floating at its bottom right, over the composer; neither is in the top bar any more. The top bar shows Deb's level as her face for it (pleased, neutral, stern), not a text tag. The meter shows the names without the "Lado A / Lado B" label; the turn marker sits next to the name. The composer's field lights up in the writer's side colour (Deb's while it holds a mention) and shows only the character count. Under a message Deb can check, a curved reply arrow beside her bubble starts a call about it (it replaces the "can be checked @deb" pill). The help popup is a list of Deb's four tools on the left (check a claim, search, ask about the score, point at a message) and the chosen one on the right: its cost (one challenge or free), what it does, and an example that lands in the field when clicked; the challenges left and "Call @deb" sit at its foot. The fallacy explanation and the rubric unfold inside Deb's bubble with a spring, the rubric's cells lighting up in turn. The feed fades out at its top and bottom edges (`fade-y`) instead of being cut by the meter and the composer. Everything clickable shows the hand cursor (a base rule in `globals.css`; Tailwind v4 dropped it for buttons).

Spectators (anyone who opens a full room) see the same page without the composer. **The projector view is just this**: open the room link on the laptop. Design the debate state so it reads from the back of a room at large zoom: the meter and the latest ledger entry must be the biggest things on screen.

The layout is one column at every size (the ledger is a popup); the room must work on two phones, that is the main use. Phone pass (2026-10-06, `feat/mobile`): the top bar is two rows under `sm` (logo and controls, then the two doors as equal tabs) and pages size themselves with `--nav-h`; the room bar keeps only Deb, the motion, the ledger and result buttons and the language switch; the meter's numbers drop to `text-3xl`; popups become bottom sheets; the join field and the mention mode stay at 16px so iOS does not zoom; `backdrop-filter` is only applied from `sm` up (the cubes run behind everything). Carry over CV-AI's mobile lessons (`../CV-AI/spec/03-ui-design.md`, "Layout em telas pequenas"): 16px inputs so iOS Safari does not zoom, `interactiveWidget: "resizes-content"`, no full-screen `backdrop-filter` over the animated background on phones.

### Join `/join` and Create `/create`

On `/create` the judge's level is picked from three faces of Deb (`admin/level-picker.tsx`: pleased for lenient, neutral for balanced, stern for strict). The created room's card shows the format as five tiles (rounds, challenges, characters, Deb's language, level with its face) and the QR code in the side colours (a blue to red gradient through `fill="url(#…)"`) on white, with Deb in its cleared middle (error correction H); the link is no longer printed under it.

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

- One composer for both moves: text that contains `@deb` goes to the bot (any time), anything else is an argument (needs the turn). The help popup's "Call @deb" and its examples insert the mention; the reply arrow beside Deb's bubble under a check-worthy message starts a call about that message. An autocomplete on typing `@`, and a reply action on every message, are not built.
- The mention appears in the chat as the debater's message with the reply target shown; right below, the bot's card starts as "searching…" and resolves to: the status for a validation (confirmed / imprecise / false / unverifiable), a short explanation, sources as links, and the score effect if any.
- Remaining challenges show as `@` glyphs in the help popup and the ledger; when none are left the mention still works for `explain`.
- Claims the judge marked check-worthy carry the reply arrow beside Deb's bubble, teaching the feature without a tutorial.

## Palette and themes (tokens in `src/app/globals.css`)

**Blue vs red** since 2026-10-07 (Lucas, after trying it locally: "I loved the red vs blue theme"). This reverses the earlier rule against red vs blue, which reads as political parties in Brazil; Lucas chose it knowing that. Before it: neon purple vs aqua (2026-10-06, third pass), and earlier lavender vs mint and violet vs green. Because red is now a side, `--destructive` (fallacy flags, "false", errors) moved from red to magenta.

Two themes (Lucas, 2026-10-06): **paper** (`:root`) and **night** (`.dark` on `<html>`). A script in `<head>` sets the class before the first paint from the stored choice, or from the system preference the first time; `src/lib/use-theme.ts` holds the store and `site/theme-switch.tsx` the button, which sits next to the language switch on every screen.

| Token | Paper | Night | Use |
|---|---|---|---|
| `--side-a` / `--side-a-deep` | `#2F6BFF` / `#1F52D9` | `#4D8DFF` / `#2F6BFF` | side A, blue, and the app's accent (primary buttons, eyebrows, links) |
| `--side-b` / `--side-b-deep` | `#E63946` / `#C8232F` | `#FF4D5E` / `#E63946` | side B, red |
| `--ink` | `#FFFFFF` | `#070708` | text on top of either side colour and on `--bot` |
| `--background` / `--card` / `--popover` | `#F6F5FB` / `#FFFFFF` / `#FFFFFF` | `#070708` / `#111113` / `#0C0C0E` | page, cards, the top bar and terminal chrome; night is a neutral near-black since 2026-10-07 (it was tinted purple) |
| `--foreground` / `--muted-foreground` | `#121020` / `#5F5B72` | `#ECECEF` / `#9A9AA3` | text |
| `--border` / `--input` | foreground at 12% / 24% | foreground at 12% / 20% | hairlines |
| `--destructive` / `--warning` | `#C026D3` / `#9A5B00` | `#E879F9` / `#FFC957` | fallacy flags, "false" and errors (magenta, so they never read as side B); "imprecise" and the mock notice |

- Components use the tokens (`bg-card`, `text-side-a`, `var(--side-a)`), never a hex value, so both themes follow.
- The cubes shader reads `--side-a`, `--side-b`, `--background` and `--foreground` at runtime and parses them as 6-digit hex: keep those four in that form.
- A side colour never means "good" or "bad": a confirmed fact-check is a neutral tag with a check mark, flags are magenta, and "live" in the admin table is the accent blue.
- Never encode a side by colour alone: always pair it with the name and the left/right position (the room dropped the "Lado A / Lado B" label on 2026-10-07; the lobby and `/create` keep it).
- `src/app/icon.svg` (the favicon) repeats Deb's idle face with the night values as fixed hex: regenerate it when the palette changes.

## vgpu: the cubes (`src/components/cubes/`)

On the night page the cubes were nearly invisible (Lucas, 2026-10-07): their alpha is now multiplied by 1.45 there (1.7 on paper, 1.0 before), the dithered ground glow is 0.1 on both pages, and the grid line 0.14.

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
