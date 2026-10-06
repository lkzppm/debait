// Limits the browser needs too; kept apart from `run.ts`, which is server-only.

/** Longest text of a call to the bot. */
export const MENTION_LIMIT = 280;
/** Calls to the bot each debater may make beyond their challenges (explanations are free). */
export const FREE_ASKS = 3;
/** A call or a judgement with no outcome after this long is treated as lost. */
export const STALE_MS = 90_000;
