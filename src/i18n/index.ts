// The interface strings live in one typed object per language: `en.tsx`
// defines the shape, `pt.tsx` must provide every key of it, so a missing
// translation is a type error, not a blank on the page. Code, docs and
// commits stay in English; only what the visitor reads is translated.
import { en } from "./en";
import { pt } from "./pt";
import type { Locale } from "./locales";

export { DEFAULT_LOCALE, LOCALES, isLocale, type Locale } from "./locales";
export type Dictionary = typeof en;

export const DICTIONARIES: Record<Locale, Dictionary> = { en, pt };
