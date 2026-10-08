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

/** The thumb's colour for each level: blue for lenient, red for strict, the two mixed in between. */
const LEVEL_THUMB: Record<Strictness, string> = {
  lenient: "bg-side-a",
  balanced: "bg-[color-mix(in_srgb,var(--side-a),var(--side-b))]",
  strict: "bg-side-b",
};

/** The judge's level as a big slider of three faces of Deb; the thumb slides to the chosen one. */
export function LevelPicker({ value, onChange }: { value: Strictness; onChange: (level: Strictness) => void }) {
  const t = useT();
  // One thumb per picker, so it slides between its own options only.
  const layoutId = useId();
  return (
    <div role="radiogroup" aria-label={t.admin.strictness} className="grid grid-cols-3 rounded-full border border-border p-1">
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
              "group relative isolate flex flex-col items-center justify-center gap-1 rounded-full px-2 py-2.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60 sm:flex-row sm:gap-3 sm:py-3 sm:text-sm",
              active ? "text-ink" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className={cn("absolute inset-0 -z-10 rounded-full", LEVEL_THUMB[level])}
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <Deb
              mood={LEVEL_FACE[level]}
              className={cn("size-7 transition-transform duration-300 sm:size-8", active ? "scale-110" : "group-hover:scale-105")}
            />
            {t.strictness[level].name}
          </button>
        );
      })}
    </div>
  );
}
