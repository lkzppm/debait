"use client";

import { DICTIONARIES, LOCALES } from "@/i18n";
import { useLocale } from "@/i18n/LocaleProvider";
import { PillSwitch } from "./pill-switch";

/** The language slider: Portuguese or English, remembered in this browser. */
export function LocaleSwitch({ className }: { className?: string }) {
  const { locale, setLocale, t } = useLocale();
  return (
    <PillSwitch
      label={t.common.language}
      value={locale}
      onChange={setLocale}
      options={LOCALES.map((option) => ({ value: option, label: DICTIONARIES[option].short, title: DICTIONARIES[option].name }))}
      className={className}
    />
  );
}
