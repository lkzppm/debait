import { isLocale, type Locale } from "@/i18n/locales";
import type { DebateContext } from "@/judge/types";
import { getDailyUsage } from "@/lib/usage";

/** Shared by the CLI scripts: argument parsing, a fixed sample debate, the usage printout. */

export function parseArgs(argv: string[]): { locale: Locale; text: string } {
  const args = argv.slice(2);
  const at = args.indexOf("--locale");
  const value = at === -1 ? undefined : args[at + 1];
  const locale: Locale = isLocale(value) ? value : "pt";
  const text = args.filter((arg, index) => index !== at && (at === -1 || index !== at + 1)).join(" ").trim();
  return { locale, text };
}

export function sampleContext(locale: Locale): DebateContext {
  return locale === "pt"
    ? { roomId: "script", locale, motion: "Home office é melhor que o trabalho presencial", stances: { a: "A favor", b: "Contra" } }
    : { roomId: "script", locale, motion: "Remote work is better than office work", stances: { a: "For", b: "Against" } };
}

export const samplePrevious = (locale: Locale) =>
  locale === "pt"
    ? "No presencial as pessoas aprendem mais rápido porque observam colegas experientes, e 60% das promoções vão para quem está no escritório."
    : "In the office people learn faster because they watch experienced colleagues, and 60% of promotions go to those who are on site.";

export async function printUsage() {
  const usage = await getDailyUsage();
  const models = Object.entries(usage);
  if (models.length === 0) return console.log("\ntokens: none recorded (mock engine)");
  for (const [model, u] of models) {
    console.log(`\ntokens: ${model}: ${u.tokens} total (${u.input} in, ${u.output} out) in ${u.requests} request(s)`);
  }
}
