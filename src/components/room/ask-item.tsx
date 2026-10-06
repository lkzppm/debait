"use client";

import { AtSign, ExternalLink } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { useT } from "@/i18n/LocaleProvider";
import { BRAND } from "@/lib/brand";
import type { AskView, MessageView, Seat } from "@/lib/debate/types";
import { cn } from "@/lib/utils";
import { sideText, signed, statusTone } from "./message-item";

/** After this long with no answer, stop promising one (matches the server's stale window). */
const LOST_AFTER_MS = 90_000;

/** True once `at + LOST_AFTER_MS` has passed, re-rendering when it does. */
function useLost(at: number, pending: boolean): boolean {
  const [lost, setLost] = useState(false);
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setLost(true), Math.max(0, at + LOST_AFTER_MS - Date.now()));
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

/** A call to the bot and its answer: a neutral card that belongs to neither side. */
export function AskItem({ ask, names, target }: AskItemProps) {
  const t = useT();
  const pending = !ask.reply && !ask.failed;
  const lost = useLost(ask.at, pending);
  const reply = ask.reply;
  const ruling = reply?.ruling ?? null;

  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mx-auto w-full max-w-2xl rounded-2xl border border-bot/20 bg-popover/90 p-4"
    >
      <header className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
        <span className="flex size-5 items-center justify-center rounded-full bg-bot text-background">
          <AtSign className="size-3" />
        </span>
        <span>
          <span className={cn("font-medium", sideText(ask.seat))}>{t.bot.called(names[ask.seat])}</span>
          {target && <span> · {t.bot.about(names[target.seat])}</span>}
        </span>
      </header>

      <p className="mt-2 text-[15px] whitespace-pre-wrap">{ask.text}</p>

      <div className="mt-3 border-t border-border pt-3 text-sm">
        {pending && !lost && <p className="shimmer">{t.bot.searching}</p>}
        {pending && lost && <p className="text-muted-foreground">{t.bot.lost}</p>}
        {ask.failed && <p className="text-destructive">{ask.failed === "budget" ? t.bot.budget : t.bot.failed}</p>}

        {reply && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-bot">{BRAND.bot.name}</span>
              <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">{t.bot.intent[reply.intent]}</span>
              {ruling && (
                <span className={cn("rounded-full border px-2 py-0.5 font-medium", statusTone(ruling.status))}>
                  {t.status[ruling.status]}
                </span>
              )}
              {ask.engine === "mock" && (
                <span className="rounded border border-border px-1 text-[10px] tracking-wide text-muted-foreground uppercase">
                  {t.common.mock}
                </span>
              )}
            </div>

            {ruling?.claimQuote && (
              <blockquote className="border-l-2 border-bot/40 pl-3 text-muted-foreground italic">{ruling.claimQuote}</blockquote>
            )}

            <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{reply.text}</p>

            {reply.sources.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground">{t.bot.sources}</p>
                <ul className="mt-1 flex flex-col gap-1">
                  {reply.sources.map((source) => (
                    <li key={source.url}>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex max-w-full items-center gap-1 text-sm text-bot underline decoration-bot/40 underline-offset-2 hover:decoration-bot"
                      >
                        <span className="truncate">{source.title}</span>
                        <ExternalLink className="size-3 shrink-0" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* What the answer did to the score, said in so many words. */}
            <p className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
              {ask.applied && ruling && target ? (
                <span className={cn("font-mono text-sm font-semibold", sideText(target.seat))}>
                  {t.bot.effect(signed(target.validation?.delta ?? 0), names[target.seat])}
                </span>
              ) : (
                <span>{t.bot.noEffect}</span>
              )}
              {ask.charged && <span>{t.bot.charged}</span>}
            </p>
          </motion.div>
        )}
      </div>
    </motion.article>
  );
}
