"use client";

import { AnimatePresence, motion } from "motion/react";
import { useT } from "@/i18n/LocaleProvider";
import { SEATS, type DebateState, type RoomMeta, type Seat } from "@/lib/debate/types";
import { cn } from "@/lib/utils";
import { sideBg, sideText, signed } from "./message-item";

/**
 * The side panel: the ledger (every score change, newest first) and the
 * challenges each debater has left.
 */
export function ScorePanel({ meta, state, names }: { meta: RoomMeta; state: DebateState; names: Record<Seat, string> }) {
  const t = useT();
  const ledger = [...state.ledger].reverse();

  return (
    <div className="flex flex-col gap-7">
      <section>
        <h2 className="eyebrow text-side-a">{t.panel.ledger}</h2>
        {ledger.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{t.panel.ledgerEmpty}</p>
        ) : (
          <ol className="mt-3 flex flex-col">
            <AnimatePresence initial={false}>
              {ledger.map((entry, index) => (
                <motion.li
                  key={entry.key}
                  layout
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  className={cn(
                    "flex items-center gap-3 border-b border-border py-2 text-sm last:border-b-0",
                    index !== 0 && "text-muted-foreground",
                  )}
                >
                  <span className={cn("w-12 shrink-0 font-mono text-base font-semibold tabular-nums", sideText(entry.seat))}>
                    {signed(entry.delta)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{names[entry.seat]}</span>
                  <span className="shrink-0 font-mono text-xs">
                    {entry.manipulation
                      ? t.panel.manipulation
                      : entry.source === "validation" && entry.status
                        ? `${t.panel.factCheck}: ${t.status[entry.status].toLowerCase()}`
                        : t.feed.round(entry.round)}
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
        )}
      </section>

      {meta.format.challenges > 0 && (
        <section>
          <h2 className="eyebrow text-side-a">{t.panel.challenges}</h2>
          <div className="mt-3 flex flex-col gap-2">
            {SEATS.map((seat) => (
              <div key={seat} className="flex items-center justify-between text-sm">
                <span className="truncate">{names[seat]}</span>
                <span className="flex gap-1" aria-label={t.composer.challenges(state.challengesLeft[seat])}>
                  {Array.from({ length: meta.format.challenges }, (_, index) => (
                    <span key={index} className={cn("size-3", index < state.challengesLeft[seat] ? sideBg(seat) : "bg-muted")} />
                  ))}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
