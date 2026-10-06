# spec/ : project knowledge base

Short, stable documents so any session (human or Claude Code) can pick up the work without re-deriving it. Read in this order:

| File | What it holds |
|---|---|
| [00-overview.md](00-overview.md) | The assignment and deadline, the idea, the two differentiators, the pitch, success criteria |
| [01-market-research.md](01-market-research.md) | Web research of 2026-10-06: competitors, evidence, verdict, how we differ, sources |
| [02-architecture.md](02-architecture.md) | As built: stack, storage drivers, event log and ledger, request flows, SSE, admin panel, languages, folder tree, decisions |
| [03-judge.md](03-judge.md) | The AI core: judgement schema, scoring math, fallacies, the `@bot` mention, anti-manipulation, free-tier budget |
| [04-ui-design.md](04-ui-design.md) | Screens, the live ledger, the mention UI, palette, the vgpu "arena" shader, motion |
| [05-stack-and-versions.md](05-stack-and-versions.md) | Versions, env vars, commands, lessons inherited from CV-AI |
| [06-roadmap.md](06-roadmap.md) | Status, name candidates, the day-by-day plan to Friday 2026-10-09, risks |

## Status legend

The scaffold was built on 2026-10-06 (see `06-roadmap.md` for what was and was not run). Documents written before the code mark their claims:

- **Decided**: chosen, build it this way unless a new fact appears.
- **Proposed**: a default worth starting from; change freely and record why.
- **Unverified**: read from docs or a search summary, never run. Check before relying on it.

## Maintenance rules

- Update the spec when a decision changes, not when a line of code changes.
- Absolute dates only (2026-10-06, never "yesterday").
- When something marked Proposed or Unverified gets built and tested, rewrite it as fact with the date.
- `CLAUDE.md` at the root points here; do not duplicate content there.
- Sister projects worth copying from: `../CV-AI` (Next.js 16 + AI SDK 7 + Groq + vgpu, the closest relative) and `../GraphMan` (`web/` uses vgpu for heavy rendering; `spec/DESIGN.md` is a full design system).
