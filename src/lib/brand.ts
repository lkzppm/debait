/**
 * Names live here and nowhere else, so renaming the project or the bot is a
 * one-file change. The wordmark colours the "AI" inside "debait": the a in
 * side A's colour, the i in side B's.
 */
export const BRAND = {
  name: "Debait",
  wordmark: ["deb", "ai", "t"] as const,
  repo: "https://github.com/lkzppm/debait",
  /** Who made it, for the footer. */
  author: {
    name: "Lucas Pacheco",
    github: "https://github.com/lkzppm",
    linkedin: "https://www.linkedin.com/in/lucasppmc/",
  },
  bot: {
    /** What people type after the @ to call the bot. */
    handle: "deb",
    name: "Deb",
  },
} as const;

export const MENTION = `@${BRAND.bot.handle}`;

/** True when the text calls the bot (`@deb`, any case, as its own token). */
export function mentionsBot(text: string): boolean {
  return new RegExp(`(^|\\s)@${BRAND.bot.handle}\\b`, "i").test(text);
}
