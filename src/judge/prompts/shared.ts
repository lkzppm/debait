import { FALLACIES, FALLACY_IDS } from "@/i18n/fallacies";
import type { Locale } from "@/i18n/locales";
import type { Seat } from "@/lib/debate/types";
import type { MentionInput, TranscriptLine } from "../types";

/** Today's date for the search prompt, so "the most recent" has a year to aim at. */
export const today = () => new Date().toISOString().slice(0, 10);

/** The judge only ever sees "A" and "B". */
export const side = (seat: Seat) => (seat === "a" ? "A" : "B");

/** One line per fallacy: id, name, definition, in the room's language. */
export function fallacyList(locale: Locale): string {
  return FALLACY_IDS.map((id) => `- ${id}: ${FALLACIES[locale][id].name}. ${FALLACIES[locale][id].definition}`).join("\n");
}

/**
 * Wraps debater text in delimiters the prompts declare as data. The closing
 * delimiter is neutralised inside the text so a message cannot end its own block.
 */
export function fence(label: string, text: string): string {
  const safe = text.replaceAll(`${label}>>>`, `${label} >>>`).replaceAll(`<<<${label}`, `<<< ${label}`);
  return `<<<${label}\n${safe}\n${label}>>>`;
}

/**
 * Short aliases (m1, m2...) for the messages a mention may point at: easier
 * for a model to copy than a random id, and mapped back afterwards.
 */
export function aliasMessages(input: MentionInput): { lines: (TranscriptLine & { alias: string })[]; byAlias: Map<string, string> } {
  const known = new Map<string, TranscriptLine>();
  for (const line of input.recent) known.set(line.id, line);
  if (input.replyTo) known.set(input.replyTo.id, input.replyTo);
  const lines = [...known.values()].map((line, index) => ({ ...line, alias: `m${index + 1}` }));
  return { lines, byAlias: new Map(lines.map((line) => [line.alias, line.id])) };
}
