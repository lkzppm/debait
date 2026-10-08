"use client";

import { motion } from "motion/react";
import { Debater } from "@/components/site/debater";
import { useT } from "@/i18n/LocaleProvider";
import type { Seat } from "@/lib/debate/types";
import { cn } from "@/lib/utils";
import { sideBg, sideText } from "./message-item";

/** Someone is writing: their avatar and a bubble of three dots that hop in turn, on their side. */
export function TypingBubble({ seat, name }: { seat: Seat; name: string }) {
  const t = useT();
  const right = seat === "b";
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.2 }}
      role="status"
      aria-label={t.feed.typing(name)}
      className={cn("flex w-full items-center gap-2", right && "flex-row-reverse")}
    >
      <Debater className={cn("size-6 shrink-0", sideText(seat))} title={name} />
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-2xl border px-4 py-3.5",
          seat === "a" ? "rounded-tl-sm border-side-a/30 bg-side-a/12" : "rounded-tr-sm border-side-b/30 bg-side-b/12",
        )}
      >
        {[0, 1, 2].map((dot) => (
          <motion.span
            key={dot}
            animate={{ y: [0, -5, 0], opacity: [0.45, 1, 0.45] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: dot * 0.15, ease: "easeInOut" }}
            className={cn("size-2 rounded-full", sideBg(seat))}
          />
        ))}
      </div>
    </motion.div>
  );
}
