"use client";

import { motion } from "motion/react";
import { useId } from "react";
import { Deb } from "@/components/site/deb";
import { useT } from "@/i18n/LocaleProvider";
import { STRICTNESS_LEVELS, type Strictness } from "@/lib/debate/types";
import { cn } from "@/lib/utils";

/** Deb's face for each level: pleased when lenient, neutral when balanced, stern when strict. */
export const LEVEL_FACE: Record<Strictness, "good" | "idle" | "stern"> = {
  lenient: "good",
  balanced: "idle",
  strict: "stern",
};

/** The judge's level as three faces of Deb; the chosen one lights up in the side colours. */
export function LevelPicker({ value, onChange }: { value: Strictness; onChange: (level: Strictness) => void }) {
  const t = useT();
  // One highlight per picker, so it slides between its own options only.
  const layoutId = useId();
  return (
    <div role="radiogroup" aria-label={t.admin.strictness} className="grid grid-cols-3 gap-2">
      {STRICTNESS_LEVELS.map((level) => {
        const active = level === value;
        return (
          <button
            key={level}
            type="button"
            role="radio"
            aria-checked={active}
            title={t.strictness[level].hint}
            onClick={() => onChange(level)}
            className={cn(
              "group relative isolate flex flex-col items-center gap-2.5 border px-2 py-4 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-side-a/40",
              active ? "border-side-a text-foreground" : "border-input text-muted-foreground hover:border-foreground/30 hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 -z-10 bg-side-a/10"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <Deb
              mood={LEVEL_FACE[level]}
              sides={active}
              className={cn("size-10 transition-transform duration-300", active ? "scale-110" : "group-hover:scale-105")}
            />
            <span className="text-sm font-medium">{t.strictness[level].name}</span>
          </button>
        );
      })}
    </div>
  );
}
