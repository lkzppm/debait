"use client";

import { AtSign, Check, CircleHelp, ShieldAlert, TriangleAlert, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Deb, verdictMood } from "@/components/site/deb";
import { useT } from "@/i18n/LocaleProvider";
import { SEATS, type DebateState, type LedgerEntry, type RoomMeta, type Seat, type ValidationStatus } from "@/lib/debate/types";
import { cn } from "@/lib/utils";
import { sideText, signed } from "./message-item";

const STATUS_ICON: Record<ValidationStatus, typeof Check> = {
  confirmed: Check,
  imprecise: TriangleAlert,
  false: X,
  unverifiable: CircleHelp,
};

/** What moved the score, as a glyph: Deb's verdict face for an argument, the ruling for a fact check. */
function EntryIcon({ entry }: { entry: LedgerEntry }) {
  if (entry.manipulation) return <ShieldAlert className="size-4" />;
  if (entry.source === "validation" && entry.status) {
    const Icon = STATUS_ICON[entry.status];
    return <Icon className="size-4" />;
  }
  return <Deb mood={verdictMood(entry.delta)} className="size-4" />;
}

/**
 * The ledger ("Extrato"): every score change grouped by round, newest round
 * first, each with an icon for what caused it and the points it moved. A
 * round's header carries each side's subtotal. Under it, the challenges
 * each debater has left.
 */
export function ScorePanel({ meta, state, names }: { meta: RoomMeta; state: DebateState; names: Record<Seat, string> }) {
  const t = useT();

  const rounds = new Map<number, LedgerEntry[]>();
  for (const entry of state.ledger) rounds.set(entry.round, [...(rounds.get(entry.round) ?? []), entry]);
  const ordered = [...rounds.entries()].sort(([x], [y]) => y - x);

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="eyebrow text-side-a">{t.panel.ledger}</h2>
        {ordered.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{t.panel.ledgerEmpty}</p>
        ) : (
          <div className="mt-3 flex flex-col gap-4">
            <AnimatePresence initial={false}>
              {ordered.map(([round, entries]) => {
                const subtotal = (seat: Seat) => entries.filter((entry) => entry.seat === seat).reduce((sum, entry) => sum + entry.delta, 0);
                return (
                  <motion.section key={round} layout="position" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
                    <header className="flex items-center justify-between border-b border-border pb-1.5">
                      <h3 className="eyebrow text-muted-foreground">{t.feed.round(round)}</h3>
                      <span className="flex gap-3 font-mono text-xs tabular-nums">
                        {SEATS.map((seat) => (
                          <span key={seat} className={sideText(seat)}>
                            {signed(subtotal(seat))}
                          </span>
                        ))}
                      </span>
                    </header>
                    <ol className="mt-1 flex flex-col">
                      <AnimatePresence initial={false}>
                        {[...entries].reverse().map((entry) => (
                          <motion.li
                            key={entry.key}
                            layout="position"
                            initial={{ opacity: 0, x: 16 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ type: "spring", stiffness: 380, damping: 30 }}
                            className="flex items-center gap-3 py-1.5 text-sm"
                          >
                            <span
                              className={cn(
                                "grid size-7 shrink-0 place-items-center",
                                entry.seat === "a" ? "bg-side-a/15 text-side-a" : "bg-side-b/15 text-side-b",
                              )}
                            >
                              <EntryIcon entry={entry} />
                            </span>
                            <span className="min-w-0 flex-1 truncate">
                              <span className="font-medium">{names[entry.seat]}</span>
                              <span className="text-muted-foreground">
                                {" · "}
                                {entry.manipulation
                                  ? t.panel.manipulation
                                  : entry.source === "validation" && entry.status
                                    ? `${t.bot.intent.validate.toLowerCase()}: ${t.status[entry.status].toLowerCase()}`
                                    : t.panel.argument}
                              </span>
                            </span>
                            <span className={cn("shrink-0 font-mono font-semibold tabular-nums", entry.delta < 0 ? "text-destructive" : sideText(entry.seat))}>
                              {signed(entry.delta)}
                            </span>
                          </motion.li>
                        ))}
                      </AnimatePresence>
                    </ol>
                  </motion.section>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </section>

      {meta.format.challenges > 0 && (
        <section>
          <h2 className="eyebrow text-side-a">{t.panel.challenges}</h2>
          <div className="mt-3 flex flex-col gap-2">
            {SEATS.map((seat) => (
              <div key={seat} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{names[seat]}</span>
                <span className="flex gap-1" aria-label={t.composer.challenges(state.challengesLeft[seat])}>
                  {Array.from({ length: meta.format.challenges }, (_, index) => (
                    <AtSign
                      key={index}
                      className={cn("size-4", index < state.challengesLeft[seat] ? sideText(seat) : "text-muted-foreground/30")}
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
