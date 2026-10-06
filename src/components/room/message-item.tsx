"use client";

import { AtSign, ChevronDown, RotateCw, Scale, ShieldAlert } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { useT } from "@/i18n/LocaleProvider";
import { MENTION } from "@/lib/brand";
import { findQuote } from "@/lib/debate/quote";
import { QUALITY_KEYS, type MessageView, type Seat } from "@/lib/debate/types";
import { cn } from "@/lib/utils";

interface Mark {
  start: number;
  end: number;
  /** Index of the counted penalty, or null for a claim the bot ruled on. */
  penalty: number | null;
}

/** Splits the message into plain and marked runs; overlapping marks keep the first. */
function segments(text: string, marks: Mark[]) {
  const sorted = [...marks].sort((x, y) => x.start - y.start);
  const runs: { text: string; mark: Mark | null }[] = [];
  let at = 0;
  for (const mark of sorted) {
    if (mark.start < at) continue;
    if (mark.start > at) runs.push({ text: text.slice(at, mark.start), mark: null });
    runs.push({ text: text.slice(mark.start, mark.end), mark });
    at = mark.end;
  }
  if (at < text.length) runs.push({ text: text.slice(at), mark: null });
  return runs;
}

const signed = (value: number) => (value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : "0");

interface MessageItemProps {
  message: MessageView;
  name: string;
  /** This browser holds a seat and the debate is live: it may call the bot or retry. */
  canAct: boolean;
  onAsk: (messageId: string) => void;
  onRetry: (messageId: string) => void;
}

/** One argument and, under it, what the judge made of it: the score with its math. */
export function MessageItem({ message, name, canAct, onAsk, onRetry }: MessageItemProps) {
  const t = useT();
  const [openPenalty, setOpenPenalty] = useState<number | null>(null);
  const [showRubric, setShowRubric] = useState(false);
  const { judgement, score, validation } = message;
  const right = message.seat === "b";

  const marks = useMemo(() => {
    const found: Mark[] = [];
    if (judgement && score) {
      score.penalties.forEach((penalty, index) => {
        const range = findQuote(message.text, judgement.fallacies[penalty.index].quote);
        if (range) found.push({ ...range, penalty: index });
      });
    }
    if (validation) {
      const range = findQuote(message.text, validation.claimQuote);
      if (range) found.push({ ...range, penalty: null });
    }
    return found;
  }, [message.text, judgement, score, validation]);

  const toggle = (index: number) => setOpenPenalty((current) => (current === index ? null : index));
  const opened = openPenalty !== null && judgement && score ? score.penalties[openPenalty] : null;
  const checkable = judgement?.claims.find((claim) => claim.checkworthy && claim.kind === "fact");

  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn("flex w-full flex-col gap-1.5", right ? "items-end" : "items-start")}
    >
      <header className={cn("flex items-center gap-2 px-1 text-xs text-muted-foreground", right && "flex-row-reverse")}>
        <span className={cn("font-medium", sideText(message.seat))}>{name}</span>
        <span>{t.feed.round(message.round)}</span>
      </header>

      <div
        className={cn(
          "max-w-[min(100%,42rem)] rounded-2xl border px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap",
          message.seat === "a"
            ? "rounded-tl-md border-side-a/30 bg-side-a/10"
            : "rounded-tr-md border-side-b/30 bg-side-b/10",
        )}
      >
        {segments(message.text, marks).map((run, index) =>
          run.mark === null ? (
            <span key={index}>{run.text}</span>
          ) : run.mark.penalty === null ? (
            <span key={index} className="excerpt-checked" title={t.feed.checked}>
              {run.text}
            </span>
          ) : (
            // A span, not a <button>: a button is an inline block and would not wrap with the sentence.
            <span
              key={index}
              role="button"
              tabIndex={0}
              className="excerpt"
              data-open={openPenalty === run.mark.penalty}
              onClick={() => toggle(run.mark!.penalty!)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  toggle(run.mark!.penalty!);
                }
              }}
            >
              {run.text}
            </span>
          ),
        )}
      </div>

      <div className={cn("flex w-full max-w-[min(100%,42rem)] flex-col gap-1.5 px-1 text-sm", right && "items-end text-right")}>
        {!judgement && !message.failed && (
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <Scale className="size-3.5" />
            <span className="shimmer">{t.feed.judging}</span>
          </p>
        )}

        {!judgement && message.failed && (
          <p className="flex flex-wrap items-center gap-2 text-destructive">
            {message.failed === "budget" ? t.feed.judgeBudget : t.feed.judgeFailed}
            {canAct && message.failed !== "budget" && (
              <button type="button" onClick={() => onRetry(message.id)} className="inline-flex items-center gap-1 underline underline-offset-2">
                <RotateCw className="size-3.5" />
                {t.feed.retry}
              </button>
            )}
          </p>
        )}

        {judgement && score && (
          <>
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 380, damping: 26 }}
              className={cn("flex flex-wrap items-center gap-x-2 gap-y-1", right && "flex-row-reverse")}
            >
              <Scale className="size-4 text-bot" />
              {/* The formula with its numbers: points = rubric - penalties. */}
              <span className="font-mono tabular-nums">
                <span className={cn("text-base font-semibold", sideText(message.seat))}>{signed(score.points)}</span>
                {!score.manipulation && score.penalty > 0 && (
                  <span className="text-muted-foreground">
                    {" = "}
                    {score.base} {"−"} {score.penalty}
                  </span>
                )}
              </span>

              {score.penalties.map((penalty, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => toggle(index)}
                  aria-expanded={openPenalty === index}
                  className={cn(
                    "rounded-full border border-warning/40 px-2 py-0.5 text-xs text-warning transition-colors hover:bg-warning/15",
                    openPenalty === index && "bg-warning/15",
                  )}
                >
                  {t.fallacies[penalty.type].name} {signed(-penalty.points)}
                </button>
              ))}

              {validation && (
                <span className={cn("rounded-full border px-2 py-0.5 text-xs", statusTone(validation.status))}>
                  {t.status[validation.status]} {validation.delta !== 0 && signed(validation.delta)}
                </span>
              )}

              {message.engine === "mock" && (
                <span className="rounded border border-border px-1 text-[10px] tracking-wide text-muted-foreground uppercase">
                  {t.common.mock}
                </span>
              )}

              <button
                type="button"
                onClick={() => setShowRubric((shown) => !shown)}
                aria-expanded={showRubric}
                className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
              >
                {t.feed.rubric}
                <ChevronDown className={cn("size-3.5 transition-transform", showRubric && "rotate-180")} />
              </button>
            </motion.div>

            {score.manipulation && (
              <p className="flex items-center gap-1.5 text-destructive">
                <ShieldAlert className="size-4" />
                {t.feed.manipulation}
              </p>
            )}

            {judgement.note && <p className="text-muted-foreground">{judgement.note}</p>}

            {opened && judgement && (
              <div className="w-full rounded-xl border border-warning/30 bg-warning/5 p-3 text-left">
                <p className="text-sm font-medium text-warning">
                  {t.fallacies[opened.type].name}
                  <span className="ml-2 font-normal text-muted-foreground">{t.feed.severity(opened.severity)}</span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t.fallacies[opened.type].definition}</p>
                <p className="mt-2 text-sm">{judgement.fallacies[opened.index].explanation}</p>
              </div>
            )}

            {showRubric && (
              <div className="grid w-full grid-cols-2 gap-x-4 gap-y-1.5 rounded-xl border border-border bg-card/60 p-3 text-left sm:grid-cols-4">
                {QUALITY_KEYS.map((key) => {
                  const skipped = key === "rebuttal" && message.isOpening;
                  const value = judgement.quality[key];
                  return (
                    <div key={key}>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{t.quality[key]}</span>
                        <span className="font-mono tabular-nums">{skipped ? t.feed.notApplicable : value}</span>
                      </div>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                        {!skipped && (
                          <div className={cn("h-full rounded-full", sideBg(message.seat))} style={{ width: `${value * 10}%` }} />
                        )}
                      </div>
                    </div>
                  );
                })}
                {message.isOpening && <p className="col-span-full text-xs text-muted-foreground">{t.feed.openingNote}</p>}
              </div>
            )}

            {canAct && !validation && checkable && (
              <p className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground", right && "flex-row-reverse")}>
                <span>{t.feed.canCheck}</span>
                <button
                  type="button"
                  onClick={() => onAsk(message.id)}
                  className="inline-flex items-center gap-0.5 rounded-full border border-bot/30 px-2 py-0.5 text-bot hover:bg-bot/10"
                >
                  <AtSign className="size-3" />
                  {MENTION.slice(1)}
                </button>
              </p>
            )}
          </>
        )}
      </div>
    </motion.article>
  );
}

export const sideText = (seat: Seat) => (seat === "a" ? "text-side-a" : "text-side-b");
export const sideBg = (seat: Seat) => (seat === "a" ? "bg-side-a" : "bg-side-b");

export function statusTone(status: "confirmed" | "imprecise" | "false" | "unverifiable") {
  if (status === "confirmed") return "border-success/40 text-success";
  if (status === "imprecise") return "border-warning/40 text-warning";
  if (status === "false") return "border-destructive/50 text-destructive";
  return "border-border text-muted-foreground";
}

export { signed };
