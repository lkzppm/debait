"use client";

import { ArrowUp, CheckCheck, Reply } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Deb } from "@/components/site/deb";
import { Debater } from "@/components/site/debater";
import { Tag } from "@/components/site/pill";
import { useT } from "@/i18n/LocaleProvider";
import { BRAND, MENTION } from "@/lib/brand";
import { STALE_MS } from "@/lib/debate/limits";
import type { AskView, MessageView, Seat } from "@/lib/debate/types";
import { cn } from "@/lib/utils";
import { Charge, sideText, SourceList, StatusTag } from "./message-item";

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

/** The call with its @handle highlighted. */
export function Mention({ text }: { text: string }) {
  const parts = text.split(new RegExp(`(${MENTION})`, "i"));
  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === MENTION ? (
          <span key={index} className="font-semibold text-bot">
            {part}
          </span>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}

/** Scrolls the feed to a message and makes it blink once, so the eye finds it. Ghost copies (inert) are skipped. */
function showMessage(id: string) {
  const element = document.querySelector<HTMLElement>(`[data-message="${id}"]:not([inert] *)`);
  if (!element) return;
  element.scrollIntoView({ behavior: "smooth", block: "center" });
  element.animate([{ opacity: 1 }, { opacity: 0.35 }, { opacity: 1 }], { duration: 900, delay: 350, easing: "ease-in-out" });
}

interface AskItemProps {
  ask: AskView;
  names: Record<Seat, string>;
  /** The message the debater pointed at, or the one the bot ruled on. */
  target: MessageView | null;
}

/**
 * A call to the bot, as two bubbles on the caller's side: the request, then
 * Deb's answer with its tags, its sources and what it did to the score.
 */
export function AskItem({ ask, names, target }: AskItemProps) {
  const t = useT();
  const pending = !ask.reply && !ask.failed;
  const lost = useLost(ask.at, pending);
  const reply = ask.reply;
  const ruling = reply?.ruling ?? null;
  const working = pending && !lost;
  const right = ask.seat === "b";
  const checked = ask.applied && ruling !== null;

  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn("flex w-full flex-col gap-1.5", right ? "items-end" : "items-start")}
    >
      <header className={cn("flex items-baseline gap-2 px-1 text-xs", right ? "flex-row-reverse pr-8" : "pl-8")}>
        <span className={cn("font-medium", sideText(ask.seat))}>{names[ask.seat]}</span>
        <span className="text-muted-foreground">{t.bot.called}</span>
      </header>

      {/* The request: the debater's bubble, dashed in the bot's colour since it is not an argument. */}
      <div className={cn("flex w-full max-w-[min(100%,40rem)] items-start gap-2", right && "flex-row-reverse")}>
        <Debater className={cn("mt-1.5 size-6 shrink-0", sideText(ask.seat))} title={names[ask.seat]} />
        <div className={cn("w-fit max-w-full rounded-2xl border border-dashed border-bot/40 bg-card", right ? "rounded-tr-sm" : "rounded-tl-sm")}>
          <p className="px-4 py-3 text-base leading-relaxed whitespace-pre-wrap">
            <Mention text={ask.text} />
          </p>
          {target && (
            <p className="flex items-center gap-1.5 border-t border-border px-4 py-2 text-xs text-muted-foreground">
              <Reply className={cn("size-3.5 shrink-0 text-bot", right && "-scale-x-100")} />
              <span className="truncate">
                {t.bot.about(names[target.seat])}: {ruling?.claimQuote || target.text}
              </span>
            </p>
          )}
        </div>
      </div>

      {/* The answer: Deb's bubble, with her face as the avatar. */}
      <div className={cn("flex w-full max-w-[min(100%,40rem)] items-start gap-2", right && "flex-row-reverse")}>
        <Deb mood={working ? "busy" : ask.failed || lost ? "stern" : "idle"} className="mt-1.5 size-6 shrink-0 text-bot" title={BRAND.bot.name} />
        <div className={cn("flex min-w-0 flex-1 flex-col text-sm", right && "items-end")}>
          <div className={cn("w-fit max-w-full rounded-2xl border border-bot/25 bg-card", right ? "rounded-tr-sm" : "rounded-tl-sm")}>
            {working && (
              <p className="px-3.5 py-2.5 text-muted-foreground">
                <span className="shimmer">{t.bot.searching}</span> <span className="caret" />
              </p>
            )}
            {pending && lost && <p className="px-3.5 py-2.5 text-muted-foreground">{t.bot.lost}</p>}
            {ask.failed && <p className="px-3.5 py-2.5 text-destructive">{ask.failed === "budget" ? t.bot.budget : t.bot.failed}</p>}

            {/* A check that ruled on a message: the verdict, its sources and its points are shown on that message. */}
            {reply && checked && target && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3.5 py-2.5">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <CheckCheck className="size-4 text-bot" />
                  {t.bot.checked}
                </span>
                <button
                  type="button"
                  onClick={() => showMessage(target.id)}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground hover:decoration-foreground"
                >
                  <ArrowUp className="size-3.5" />
                  {t.bot.seeMessage(names[target.seat])}
                </button>
                {ask.engine === "mock" && <Tag className="text-muted-foreground">{t.common.mock}</Tag>}
                {ask.charged && <Charge />}
              </motion.div>
            )}

            {reply && !checked && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-3 px-3.5 py-3 text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <Tag className="text-muted-foreground">{t.bot.intent[reply.intent]}</Tag>
                  {ruling && <StatusTag status={ruling.status}>{t.status[ruling.status]}</StatusTag>}
                  {ask.engine === "mock" && <Tag className="text-muted-foreground">{t.common.mock}</Tag>}
                  {ask.charged && <Charge />}
                </div>

                <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{reply.text}</p>

                <SourceList sources={reply.sources} />
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </motion.article>
  );
}
