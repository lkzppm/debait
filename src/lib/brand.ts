/**
 * Names live here and nowhere else, so renaming the project or the bot is a
 * one-file change. The wordmark highlights the "AI" inside "debait".
 */
export const BRAND = {
  name: "Debait",
  wordmark: ["deb", "ai", "t"] as const,
  repo: "https://github.com/lkzppm/debait",
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

/**
 * The two sides. Deliberately not red vs blue or green/yellow vs red, which
 * read as political parties in Brazil; cyan and orange also differ in
 * lightness, so they survive colour blindness.
 */
export const SIDE_COLORS = { a: "#38BDF8", b: "#FB923C" } as const;
