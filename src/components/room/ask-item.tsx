"use client";

import { ArrowUpRight } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Deb } from "@/components/site/deb";
import { Tag } from "@/components/site/pill";
import { useT } from "@/i18n/LocaleProvider";
import { BRAND } from "@/lib/brand";
import { STALE_MS } from "@/lib/debate/limits";
import type { AskView, MessageView, Seat } from "@/lib/debate/types";
import { cn } from "@/lib/utils";
import { sideText, signed, StatusTag } from "./message-item";

/** True once the answer is overdue (the server's stale window), re-rendering when that happens. */
function useLost(at: number, pending: boolean): boolean {
  const [lost, setLost] = useState(false);
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setLost(true), Math.max(0, at + STALE_MS - Date.now()));
    return () => clearTimeout(timer);
  }, [at, pending]);
  return pending && lost;
}

interface AskItemProps {
  ask: AskView;
  names: Record<Seat, string>;
  /** The message the debater pointed at, or the one the bot ruled on. */
  target: MessageView | null;
}

/**
 * A call to the bot, shown as a terminal window: the debater's line is the
 * command, the bot's answer is the output, and the bar at the bottom says
 * what it did to the score.
 */
export function AskItem({ ask, names, target }: AskItemProps) {
  const t = useT();
  const pending = !ask.reply && !ask.failed;
  const lost = useLost(ask.at, pending);
  const reply = ask.reply;
  const ruling = reply?.ruling ?? null;
  const working = pending && !lost;

  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mx-auto w-full max-w-3xl border border-border bg-card"
    >
      <header className="flex items-center gap-3 border-b border-border px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-destructive" />
          <span className="size-2.5 rounded-full bg-warning" />
          <span className="size-2.5 rounded-full bg-side-b" />
        </span>
        <Deb mood={working ? "busy" : "idle"} className="size-4 text-bot" />
        <span className="min-w-0 flex-1 truncate">
          {BRAND.bot.handle}@{BRAND.name.toLowerCase()}
        </span>
        <span className="uppercase">{working ? t.bot.state.working : reply ? t.bot.state.done : t.bot.state.failed}</span>
      </header>

      <div className="px-4 py-4">
        <p className="font-mono text-sm">
          <span className={sideText(ask.seat)}>{names[ask.seat]} $</span> <span className="whitespace-pre-wrap">{ask.text}</span>
        </p>
        {target && (
          <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
            {"↳"} {t.bot.about(names[target.seat])}: {ruling?.claimQuote || target.text}
          </p>
        )}

        <div className="mt-4 text-[15px]">
          {working && (
            <p className="font-mono text-sm text-muted-foreground">
              <span className="shimmer">{t.bot.searching}</span> <span className="caret" />
            </p>
          )}
          {pending && lost && <p className="font-mono text-sm text-muted-foreground">{t.bot.lost}</p>}
          {ask.failed && <p className="font-mono text-sm text-destructive">{ask.failed === "budget" ? t.bot.budget : t.bot.failed}</p>}

          {reply && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Tag className="text-muted-foreground">{t.bot.intent[reply.intent]}</Tag>
                {ruling && <StatusTag status={ruling.status}>{t.status[ruling.status]}</StatusTag>}
                {ask.engine === "mock" && <Tag className="text-muted-foreground">{t.common.mock}</Tag>}
              </div>

              <p className="leading-relaxed whitespace-pre-wrap sm:text-base">{reply.text}</p>

              {reply.sources.length > 0 && (
                <div>
                  <p className="eyebrow text-muted-foreground">{t.bot.sources}</p>
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {reply.sources.map((source, index) => (
                      <li key={source.url} className="flex items-baseline gap-2 font-mono text-sm">
                        <span className="text-muted-foreground">[{index + 1}]</span>
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex min-w-0 items-center gap-1 text-side-a underline decoration-side-a/40 underline-offset-4 hover:decoration-side-a"
                        >
                          <span className="truncate">{source.title}</span>
                          <ArrowUpRight className="size-3.5 shrink-0" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {reply && (
        // What the answer did to the score, said in so many words.
        <footer className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-border px-4 py-2.5 font-mono text-xs text-muted-foreground">
          {ask.applied && ruling && target ? (
            <span className={cn("text-sm font-semibold", sideText(target.seat))}>
              {t.bot.effect(signed(target.validation?.delta ?? 0), names[target.seat])}
            </span>
          ) : (
            <span>{t.bot.noEffect}</span>
          )}
          {ask.charged && <span className="uppercase">{t.bot.charged}</span>}
        </footer>
      )}
    </motion.article>
  );
}
