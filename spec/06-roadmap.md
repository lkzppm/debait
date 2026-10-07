# 06 — Roadmap and status

## Status on 2026-10-06 (Tuesday)

**Presentation: Friday 2026-10-09, 15 minutes.**

Done today:

- [x] Idea validated by web research (`01-market-research.md`); differentiation defined; name decided (**Debait**, bot **@deb**).
- [x] Public repository `lkzppm/debait`, branches `main` and `dev`, CI (lint, types, shader check, build).
- [x] Scaffold of the whole application: rooms and seats, turn-based debate, event log with live updates over SSE, scoring and reducer, the judge layer (Groq engine + mock engine, prompts in pt and en), the `@deb` mention, the closing ruling, the admin panel with usage tracking, bilingual interface, the vgpu background with a fallback.
- [x] Visual redesign the same day, after Lucas rejected the first look: the cognee.ai direction (black page, pixel grid, vgpu cubes, purple vs green). Details in `04-ui-design.md`. On branch `feat/pixel-grid-visual`, uncommitted until Lucas has looked at it.
- [x] Revision of that redesign, also 2026-10-06 (Lucas): landing page laid out like GraphMan's (live mark, name, one sentence, a scripted demo figure, three facts), light and dark themes with new colours, and a richer cubes shader (raised cubes, captures at the frontier, dithered glow, pointer rings). **Not seen running by Claude**; typecheck, lint and `vgpu check` pass.

What was actually run, and what was not:

| | State |
|---|---|
| `pnpm lint`, `pnpm typecheck`, `pnpm build`, `vgpu check` | pass |
| A full debate through the HTTP API on the **mock judge + memory store** (join, turn guard, judgements, `@deb` validate and explain, busy guard, manipulation flag, finish, ruling, admin list, delete, SSE resume with `Last-Event-ID`) | ran, behaved as designed |
| Screens in headless Chromium at 1440 px and 390 px (landing, lobby, live room as a debater, score tab, admin) | looked at once, **before** the revision (new landing, themes, new shader); nothing after it was seen |
| **Groq engine** (`src/judge/groq.ts`), prompts, schemas under strict mode, `browser_search` | **never run**: no API key yet |
| **Upstash driver** | ran on production on 2026-10-06: the admin API reports store `upstash` (listing rooms); creating and playing a room on it is next |
| **Vercel deployment** | **done 2026-10-06**: https://debait-ufrj.vercel.app, details in `05-stack-and-versions.md`. `after()` and the SSE recycle on Vercel still unobserved |
| The **Groq engine from the scripts** (`pnpm judge`, `pnpm mention --reply`, a ruling) | ran once each on 2026-10-06 with Lucas's key; see `03-judge.md`. The provider dropped the search sources; fixed by reading Groq's raw `executed_tools` |
| The **cubes shader** in a WebGPU browser; real phones | **not seen by Claude**: Lucas verifies visual changes himself |
| Unit tests | none written (Lucas: no testing for now) |

## Next steps (in order)

1. **Lucas refines the interface and the agent logic** on the mock judge (`pnpm dev`, no configuration).
2. **Put the Groq key in `.env.local`** and go through the checklist "First run with a key" in `03-judge.md`, starting with `pnpm judge`. This is the riskiest unknown left: do it before polishing.
3. Look at the landing page, both themes and the cubes in Chrome and on a phone; tune them (the shader's knobs are the `alpha`, `capture` and `glow` lines in `cubes.wgsl`).
4. Upstash Redis + Vercel project + env vars (`05-stack-and-versions.md`, "Deploying"); one debate between two phones on mobile data.
5. Rehearse the demo with the real motion; record a backup video.

## Open questions for Lucas

1. Who are the two debaters in the live demo, and which motion? Rehearse with that exact motion.
2. Vercel project name and URL: `debait.vercel.app` and `debait-ai.vercel.app` are taken; `debait-app` and `usedebait` were free on 2026-10-06.

Answered on 2026-10-06: the assignment (see `00-overview.md`); Groq is required; stay on the free tier; codebase in English with an en/pt-BR switch for UI and prompts; debates are created only from an admin panel; the name.

## Names: decided, with the candidates that lost (2026-10-06)

`*.vercel.app` availability was checked by requesting the subdomain on 2026-10-06 (free = Vercel answered "deployment not found"). No trademark or domain search was done.

| Project | Bot | Why | vercel.app |
|---|---|---|---|
| **Debait** | **@deb** | **Chosen.** Lucas's own proposal (2026-10-06). A pun on debate + bait, with "AI" sitting in the middle (deb**AI**t). Works in both languages without translation; "bait" is common Brazilian internet slang. `@deb` is short and reads like a person's name. | `debait` and `debait-ai` taken; `debait-app` and `usedebait` free |
| **Tira-Teima** | **@VAR** | "Tira-teima" is the Brazilian expression for whatever settles a dispute, and "chama o VAR" is what people already say when they want a claim reviewed. The mention *is* the idiom. | `tira-teima` and `tirateima` taken; `tirateima-ai` free |
| **Chama o VAR** | **@VAR** | The catchphrase as the product name; instantly understood in a Brazilian classroom. | `chamaovar` and `chama-o-var` free |
| **Contraponto** | **@juiz** | Sober, works for serious motions too; reads fine in English ("counterpoint"). | `contraponto` free |
| **Tréplica** | **@Têmis** | The debate term for the reply to a reply; Têmis is the goddess of justice. More academic in tone. | `treplica` taken |
| **Debate.ai** | **@VAR** or **@juiz** | The working title: descriptive and bilingual, but generic. | `debate-ai` and `debateai` taken |

Checks run for "debait" on 2026-10-06: no product by that name turned up in a web search of AI debate apps; no npm package; GitHub has about 46 small repositories with the name (the largest has 5 stars, one of them a hackathon AI debater), so the pun has occurred to others but nobody owns it. Domains `debait.ai`, `.app`, `.com` and `.io` are registered (parked or for sale, no live product seen); `debait.dev`, `debait.com.br` and `debait.chat` had no DNS records, which suggests they are unregistered but was not confirmed with a registrar. No trademark search.

One thing to handle on purpose: "bait" suggests provoking people. Make that the point: fallacies are the bait, and the bot is what stops you from taking it (tagline idea: "Debata. Não morda a isca." / "Debate. Don't take the bait.").

Earlier recommendation, before Lucas proposed Debait: **Tira-Teima with the bot @VAR** (or "Chama o VAR" outright). It is the only option here that no English-language competitor could have, it explains the `@` feature by itself, and it fits a professor who likes bold framing. Trade-off: the names do not translate, so the English UI keeps them as brand names with a tagline ("the tie-breaker for arguments"). VAR is a football term; fine for a class project, worth a second thought for anything commercial.

## Plan to Friday

### Tuesday 2026-10-06 — done
Research, spec, repository, and the scaffold described above (ahead of the original plan, which had only the judge in the terminal for today; the price is that the judge itself is still untested against the real model).

Evening pass (2026-10-06, local, not yet committed): Deb's feedback and the `@deb` calls as chat bubbles, the ledger and the result as popups, the composer's `@` button replaced by a Deb help popup, and **three levels of the judge** (lenient, balanced, strict) picked on `/create` (`03-judge.md`, `04-ui-design.md`). Seen on Groq: the lenient prompt still flags one fallacy per weak message (confidence 0.9) and rates a bad rebuttal 2/1/2, so the leniency that is certain is the code's (4 points per severity, cap 20); the calibration wording was firmed up after that run and not re-tested.

### Wednesday 2026-10-07 — make the judge real
- Groq key; the first-run checklist in `03-judge.md`; tune prompts and `maxOutputTokens` with `pnpm judge` and `pnpm mention`; measure tokens per call.
- Upstash + Vercel; a debate between two real devices on the deployment.
- Interface refinement (Lucas).

### Thursday 2026-10-08 — the look and the rehearsal
- The cubes in a real browser; real phones on mobile data; both languages.
- Full rehearsal with the demo motion. Record a backup video of a good run.
- Slides or presentation notes in `docs/`.
- **Stop feature work by Thursday night.** A debate uses a noticeable share of the daily token quota (`03-judge.md`), and the quota must be full on Friday.

### Friday 2026-10-09 — present
- One short smoke test at most before class (quota). Check the projector browser for WebGPU. Admin panel open on the laptop to watch usage during the demo.

### Cut line
If time runs short: drop the cubes shader (the static fallback becomes the look) before touching the ledger or `@deb`. Those two are the project. If the Groq mention with web search proves unreliable, keep `@deb` for explanations and rehearsed validations only.

## After Friday (ideas, not planned)

- Unit tests for `scoring.ts` and `reducer.ts` (pure functions, cheap to cover).
- An automatic retry on a 429 after the delay Groq reports; a countdown before the debate starts; `@` autocomplete and a reply action on every message.
- Projector "stage" view; spectators who vote from their phones and an audience-vs-judge reveal.
- Solo mode against an AI opponent (also the best way to test alone).
- Automatic fact-check of every check-worthy claim, instead of only on `@bot`.
- Second-opinion judge on another model; show where the two disagree.
- Evaluation: labelled fixture set with precision and recall, run-to-run variance, side-swap test.
- Public room creation with rate limits and a daily budget guard.
- Free-flow mode, teams, voice input, shareable result card.

## Risks

| Risk | Why it matters | Mitigation |
|---|---|---|
| The Groq engine has never run | The core of the demo | First thing on Wednesday; the checklist in `03-judge.md`; the mock keeps the UI work unblocked meanwhile, but is not a fallback for the presentation |
| Three days | Everything | The cut line above; no feature work on Friday |
| Judge is wrong on stage | Credibility of the whole demo | Confidence threshold, verbatim quotes, a rehearsed motion, "the bot can be wrong" framing |
| Free-tier limit during the demo | Debate stalls in front of the class | Only the admin creates debates; short format (3 rounds); model split; challenge cap; no heavy testing on Friday; visible "thinking" state; backup video |
| Realtime drops on venue Wi-Fi or at the function limit | Meter stops moving | Snapshot + dedupe design, polling fallback, test on mobile data |
| Political motion goes sideways | Classroom discomfort, accusations of bias | Playful demo motion; sides anonymised to the model; score is about form |
| WebGPU missing on the projector laptop | No animated cubes | Static fallback; check the browser beforehand (Chrome/Edge, Safari 26+, Firefox 141+) |
| "This already exists" | Professor values originality | Know the competitors (`01-market-research.md`), lead with the two differentiators |
