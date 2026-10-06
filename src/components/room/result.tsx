"use client";

import { Trophy } from "lucide-react";
import { motion } from "motion/react";
import { useT } from "@/i18n/LocaleProvider";
import { BRAND } from "@/lib/brand";
import { SEATS, type DebateState, type Seat } from "@/lib/debate/types";
import { cn } from "@/lib/utils";
import { sideText } from "./message-item";

/** The end of the debate: who argued better by the numbers, and the bot's written ruling. */
export function Result({ state, names }: { state: DebateState; names: Record<Seat, string> }) {
  const t = useT();
  const { winner, ruling } = state;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 220, damping: 24 }}
      className="mx-auto w-full max-w-2xl rounded-3xl border border-bot/25 bg-popover/95 p-5 sm:p-6"
    >
      <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">{t.result.title}</p>

      <h2 className={cn("mt-1 flex items-center gap-2 text-2xl font-semibold sm:text-3xl", winner && winner !== "draw" && sideText(winner))}>
        {winner && winner !== "draw" && <Trophy className="size-6" />}
        {winner === null ? t.result.noScore : winner === "draw" ? t.result.draw : t.result.wins(names[winner])}
      </h2>

      {state.finishedReason === "stopped" && <p className="mt-1 text-sm text-muted-foreground">{t.result.stopped}</p>}

      {winner !== null && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {SEATS.map((seat) => (
            <div key={seat} className="rounded-xl border border-border bg-card/60 p-3">
              <p className="truncate text-sm text-muted-foreground">{names[seat]}</p>
              <p className={cn("font-mono text-2xl font-semibold tabular-nums", sideText(seat))}>
                {t.feed.points(state.totals[seat])}
              </p>
            </div>
          ))}
        </div>
      )}

      {ruling && (
        <div className="mt-5 flex flex-col gap-4 text-[15px] leading-relaxed">
          <div>
            <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
              {t.result.ruling}
              {state.mock && <span className="ml-2 rounded border border-border px-1 text-[10px]">{t.common.mock}</span>}
            </p>
            <p className="mt-1 whitespace-pre-wrap">{ruling.text}</p>
          </div>

          {SEATS.map((seat) =>
            ruling.best[seat] || ruling.advice[seat] ? (
              <div key={seat} className="rounded-xl border border-border p-3">
                <p className={cn("text-sm font-medium", sideText(seat))}>{names[seat]}</p>
                {ruling.best[seat] && (
                  <>
                    <p className="mt-2 text-xs text-muted-foreground">{t.result.best}</p>
                    <blockquote className="border-l-2 border-border pl-3 text-sm italic">{ruling.best[seat]}</blockquote>
                  </>
                )}
                {ruling.advice[seat] && (
                  <>
                    <p className="mt-2 text-xs text-muted-foreground">{t.result.advice}</p>
                    <p className="text-sm">{ruling.advice[seat]}</p>
                  </>
                )}
              </div>
            ) : null,
          )}
        </div>
      )}

      <p className="mt-5 text-xs text-muted-foreground">
        {t.result.disclaimer} <span className="text-bot">{BRAND.bot.name}</span>
      </p>
    </motion.section>
  );
}
