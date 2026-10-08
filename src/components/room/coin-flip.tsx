"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Deb } from "@/components/site/deb";
import { useT } from "@/i18n/LocaleProvider";
import type { Seat } from "@/lib/debate/types";
import { cn } from "@/lib/utils";

/** Full turns the coin makes in the air before it lands. */
const SPINS = 5;

function Face({ seat, name, back = false }: { seat: Seat; name: string; back?: boolean }) {
  return (
    <span
      className={cn(
        "absolute inset-0 grid place-items-center rounded-full border-4 text-3xl font-semibold text-ink [backface-visibility:hidden]",
        seat === "a" ? "border-side-a-deep bg-side-a" : "border-side-b-deep bg-side-b",
        back && "[transform:rotateY(180deg)]",
      )}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/**
 * Before the first argument: Deb flips a coin for who opens. The coin is
 * blue on one face and red on the other, with each debater's initial; it
 * goes up spinning and lands on the opener's face, and then the opener is
 * named. The result is in the log (`room.started`), so every screen agrees;
 * the flip is only the picture of it.
 */
export function CoinFlip({ opener, names }: { opener: Seat; names: Record<Seat, string> }) {
  const t = useT();
  const [landed, setLanded] = useState(false);

  return (
    <div className="m-auto flex flex-col items-center gap-4 text-center">
      <p className="eyebrow text-muted-foreground">{t.feed.coinTitle}</p>

      <div className="flex flex-col items-center [perspective:600px]">
        {/* Up and down in an arc, while it turns about its vertical axis. */}
        <motion.div
          initial={{ y: 0, rotateY: 0 }}
          animate={{ y: [0, -110, 0], rotateY: SPINS * 360 + (opener === "a" ? 0 : 180) }}
          transition={{ duration: 1.8, ease: [0.22, 0.9, 0.3, 1], y: { duration: 1.8, times: [0, 0.45, 1], ease: ["easeOut", "easeIn"] } }}
          onAnimationComplete={() => setLanded(true)}
          className="relative size-20 [transform-style:preserve-3d]"
        >
          <Face seat="a" name={names.a} />
          <Face seat="b" name={names.b} back />
        </motion.div>
        <Deb mood={landed ? "good" : "busy"} className="mt-3 size-12 text-bot" />
      </div>

      <div className="min-h-14">
        <AnimatePresence mode="wait">
          {landed ? (
            <motion.p
              key="landed"
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 420, damping: 24 }}
              className="text-xl font-medium sm:text-2xl"
            >
              <span className={opener === "a" ? "mark-a" : "mark-b"}>{names[opener]}</span> {t.feed.coinOpens}
            </motion.p>
          ) : (
            <motion.p key="flipping" exit={{ opacity: 0 }} className="shimmer text-lg">
              {t.feed.coinFlipping}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
