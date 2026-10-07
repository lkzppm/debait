"use client";

import { motion } from "motion/react";
import { CubesBand } from "@/components/cubes/cubes-canvas";
import { Tag } from "@/components/site/pill";
import { useT } from "@/i18n/LocaleProvider";
import { SEATS, type DebateState, type Seat } from "@/lib/debate/types";
import { cn } from "@/lib/utils";
import { sideMark, sideText } from "./message-item";

/** The end of the debate: who argued better by the numbers, and the bot's written ruling. */
export function Result({ state, names }: { state: DebateState; names: Record<Seat, string> }) {
  const t = useT();
  const { winner, ruling } = state;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 220, damping: 24 }}
      className={cn(
        "mx-auto w-full max-w-3xl border bg-card",
        winner === "a" ? "border-side-a/70" : winner === "b" ? "border-side-b/70" : "border-border",
      )}
    >
      <div className="p-6 sm:p-8">
        <p className="eyebrow text-side-a">{t.result.title}</p>

        <h2 className="mt-4 text-4xl leading-tight font-medium tracking-tight sm:text-6xl">
          {winner === null ? (
            t.result.noScore
          ) : winner === "draw" ? (
            t.result.draw
          ) : (
            <span className={sideMark(winner)}>{t.result.wins(names[winner])}</span>
          )}
        </h2>

        {state.finishedReason === "stopped" && <p className="mt-3 text-muted-foreground">{t.result.stopped}</p>}

        {winner !== null && (
          <div className="mt-8 grid grid-cols-2 gap-px border border-border bg-border">
            {SEATS.map((seat) => (
              <div key={seat} className="bg-card p-4">
                <p className={cn("eyebrow", sideText(seat))}>{names[seat]}</p>
                <p className="mt-1 font-mono text-2xl tabular-nums sm:text-3xl">{t.feed.points(state.totals[seat])}</p>
              </div>
            ))}
          </div>
        )}

        {ruling && (
          <div className="mt-8 flex flex-col gap-6">
            <div>
              <p className="eyebrow flex items-center gap-2 text-muted-foreground">
                {t.result.ruling}
                {state.mock && <Tag>{t.common.mock}</Tag>}
              </p>
              <p className="mt-2 text-lg leading-relaxed whitespace-pre-wrap">{ruling.text}</p>
            </div>

            {SEATS.map((seat) =>
              ruling.best[seat] || ruling.advice[seat] ? (
                <div key={seat} className={cn("border-l-2 pl-4", seat === "a" ? "border-side-a" : "border-side-b")}>
                  <p className={cn("eyebrow", sideText(seat))}>{names[seat]}</p>
                  {ruling.best[seat] && (
                    <>
                      <p className="eyebrow mt-3 text-muted-foreground">{t.result.best}</p>
                      <blockquote className="mt-1 italic">{ruling.best[seat]}</blockquote>
                    </>
                  )}
                  {ruling.advice[seat] && (
                    <>
                      <p className="eyebrow mt-3 text-muted-foreground">{t.result.advice}</p>
                      <p className="mt-1">{ruling.advice[seat]}</p>
                    </>
                  )}
                </div>
              ) : null,
            )}
          </div>
        )}

        <p className="mt-8 text-sm text-muted-foreground">{t.result.disclaimer}</p>
      </div>

      {/* The final split, as a mosaic along the bottom of the card. */}
      {winner !== null && (
        <div className="relative h-20 border-t border-border">
          <CubesBand share={state.share} rows={4} />
        </div>
      )}
    </motion.section>
  );
}
