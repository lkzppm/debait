"use client";

import { motion } from "motion/react";
import { useId } from "react";
import { cn } from "@/lib/utils";

interface Option<T extends string> {
  value: T;
  label: string;
  title?: string;
}

interface PillSwitchProps<T extends string> {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  /** What the group chooses, for assistive technology. */
  label: string;
  size?: "sm" | "md";
  className?: string;
}

/** A row of choices in a pill; a purple thumb slides to the chosen one. */
export function PillSwitch<T extends string>({ options, value, onChange, label, size = "sm", className }: PillSwitchProps<T>) {
  // One thumb per switch, so two on a page never trade places.
  const layoutId = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("relative flex w-fit items-center rounded-full border border-border p-0.5 font-medium", size === "sm" ? "text-xs" : "text-sm", className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative z-10 rounded-full transition-colors",
              size === "sm" ? "px-3 py-1.5" : "px-4 py-2",
              active ? "text-ink" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span layoutId={layoutId} className="absolute inset-0 -z-10 rounded-full bg-side-a" transition={{ type: "spring", stiffness: 500, damping: 36 }} />
            )}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
