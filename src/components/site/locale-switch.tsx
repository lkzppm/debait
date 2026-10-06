"use client";

import { motion } from "motion/react";
import { DICTIONARIES, LOCALES } from "@/i18n";
import { useLocale } from "@/i18n/LocaleProvider";
import { cn } from "@/lib/utils";

/** The language slider: Portuguese or English, remembered in this browser. */
export function LocaleSwitch({ className }: { className?: string }) {
  const { locale, setLocale, t } = useLocale();
  return (
    <div
      role="radiogroup"
      aria-label={t.common.language}
      className={cn("panel relative flex items-center rounded-full p-0.5 text-xs font-medium", className)}
    >
      {LOCALES.map((option) => {
        const active = option === locale;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            title={DICTIONARIES[option].name}
            onClick={() => setLocale(option)}
            className={cn(
              "relative z-10 rounded-full px-2.5 py-1 transition-colors",
              active ? "text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId="locale-thumb"
                className="absolute inset-0 -z-10 rounded-full bg-foreground"
                transition={{ type: "spring", stiffness: 500, damping: 36 }}
              />
            )}
            {DICTIONARIES[option].short}
          </button>
        );
      })}
    </div>
  );
}
