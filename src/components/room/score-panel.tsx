"use client";

import { AnimatePresence, motion } from "motion/react";
import { useT } from "@/i18n/LocaleProvider";
import { QUALITY_KEYS, SEATS, type DebateState, type RoomMeta, type Seat } from "@/lib/debate/types";
import { cn } from "@/lib/utils";
import { sideBg, sideText, signed } from "./message-item";

/**
 * The side panel: the ledger (every score change, newest first), the rubric
 * averages of each side, and the challenges each debater has left.
 */
export function ScorePanel({ meta, state, names }: { meta: RoomMeta; state: DebateState; names: Record<Seat, string> }) {
  const t = useT();
  const ledger = [...state.ledger].reverse();

  return (
    <div className="flex flex-col gap-5">
      <section>
        <h2 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">{t.panel.ledger}</h2>
        {ledger.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t.panel.ledgerEmpty}</p>
        ) : (
          <ol className="mt-2 flex flex-col gap-1">
            <AnimatePresence initial={false}>
              {ledger.map((entry, index) => (
                <motion.li
                  key={entry.key}
                  layout
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm",
                    index === 0 ? "bg-accent" : "text-muted-foreground",
                  )}
                >
                  <span className={cn("w-12 shrink-0 font-mono text-base font-semibold tabular-nums", sideText(entry.seat))}>
                    {signed(entry.delta)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{names[entry.seat]}</span>
                  <span className="shrink-0 text-xs">
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

      <section>
        <h2 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">{t.panel.averages}</h2>
        <div className="mt-2 flex flex-col gap-2">
          {QUALITY_KEYS.map((key) => (
            <div key={key}>
              <div className="flex justify-between text-xs">
                <span className="font-mono text-side-a tabular-nums">{format(state.averages.a?.[key])}</span>
                <span className="text-muted-foreground">{t.quality[key]}</span>
                <span className="font-mono text-side-b tabular-nums">{format(state.averages.b?.[key])}</span>
              </div>
              {/* Two bars growing from the centre, one per side. */}
              <div className="mt-1 flex h-1.5 gap-0.5">
                <div className="flex flex-1 justify-end overflow-hidden rounded-l-full bg-muted">
                  <div className="h-full bg-side-a" style={{ width: `${(state.averages.a?.[key] ?? 0) * 10}%` }} />
                </div>
                <div className="flex-1 overflow-hidden rounded-r-full bg-muted">
                  <div className="h-full bg-side-b" style={{ width: `${(state.averages.b?.[key] ?? 0) * 10}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {meta.format.challenges > 0 && (
        <section>
          <h2 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">{t.panel.challenges}</h2>
          <div className="mt-2 flex flex-col gap-1.5">
            {SEATS.map((seat) => (
              <div key={seat} className="flex items-center justify-between text-sm">
                <span className="truncate">{names[seat]}</span>
                <span className="flex gap-1" aria-label={t.composer.challenges(state.challengesLeft[seat])}>
                  {Array.from({ length: meta.format.challenges }, (_, index) => (
                    <span
                      key={index}
                      className={cn("size-2.5 rounded-full", index < state.challengesLeft[seat] ? sideBg(seat) : "bg-muted")}
                    />
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

const format = (value: number | undefined) => (value === undefined ? "·" : value.toFixed(1));
