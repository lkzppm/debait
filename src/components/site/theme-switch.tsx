"use client";

import { Moon, Sun } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useT } from "@/i18n/LocaleProvider";
import { setTheme, useTheme } from "@/lib/use-theme";
import { cn } from "@/lib/utils";

/** Paper or night: one round button that shows the theme it switches to. */
export function ThemeSwitch({ className }: { className?: string }) {
  const t = useT();
  const theme = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  const label = next === "dark" ? t.common.themeDark : t.common.themeLight;
  const Icon = next === "dark" ? Moon : Sun;
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={label}
      title={label}
      className={cn(
        "relative grid size-8 shrink-0 place-items-center overflow-hidden rounded-full border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        className,
      )}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={next}
          initial={{ y: 14, opacity: 0, rotate: -60 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          exit={{ y: -14, opacity: 0, rotate: 60 }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
        >
          <Icon className="size-4" />
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
