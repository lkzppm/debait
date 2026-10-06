import type { Locale } from "@/i18n/locales";
import { en, type Prompts } from "./en";
import { pt } from "./pt";

export type { Prompts } from "./en";
export { aliasMessages } from "./shared";

const PROMPTS: Record<Locale, Prompts> = { en, pt };

/** The prompts in the language the bot writes in for this room. */
export function prompts(locale: Locale): Prompts {
  return PROMPTS[locale];
}
