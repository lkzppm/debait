"use client";

import { Check, ChevronDown, Reply, RotateCw, TriangleAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { Deb, verdictMood } from "@/components/site/deb";
import { Debater } from "@/components/site/debater";
import { Tag } from "@/components/site/pill";
import { useT } from "@/i18n/LocaleProvider";
import { BRAND } from "@/lib/brand";
import { findQuote } from "@/lib/debate/quote";
import { QUALITY_KEYS, type MessageView, type Seat, type ValidationStatus } from "@/lib/debate/types";
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

export const signed = (value: number) => (value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : "0");
export const sideText = (seat: Seat) => (seat === "a" ? "text-side-a" : "text-side-b");
export const sideBg = (seat: Seat) => (seat === "a" ? "bg-side-a" : "bg-side-b");
export const sideMark = (seat: Seat) => (seat === "a" ? "mark-a" : "mark-b");

/** A ruling as a tag. Confirmed is neutral on purpose: green already means side B. */
export function StatusTag({ status, children }: { status: ValidationStatus; children: React.ReactNode }) {
  const tone =
    status === "confirmed"
      ? "border-foreground/60 text-foreground"
      : status === "imprecise"
        ? "border-warning/60 text-warning"
        : status === "false"
          ? "border-destructive/60 text-destructive"
          : "border-dashed text-muted-foreground";
  return (
    <Tag className={tone}>
      {status === "confirmed" && <Check className="size-3" />}
      {(status === "false" || status === "imprecise") && <TriangleAlert className="size-3" />}
      {children}
    </Tag>
  );
}

/** A panel inside Deb's bubble that slides open to its height and fades in, and folds away the same way. */
function Unfold({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ height: { type: "spring", stiffness: 420, damping: 38 }, opacity: { duration: 0.2 } }}
      className="overflow-hidden"
    >
      <div className={className}>{children}</div>
    </motion.div>
  );
}

// Flags sit slightly crooked, like notes slapped on the message.
const TILTS = ["-rotate-1", "rotate-1", "-rotate-[0.5deg]", "rotate-[1.5deg]"];

interface MessageItemProps {
  message: MessageView;
  name: string;
  /** This browser holds a seat and the debate is live: it may call the bot or retry. */
  canAct: boolean;
  onAsk: (messageId: string) => void;
  onRetry: (messageId: string) => void;
}

/** One argument and, under it, what the judge made of it, in a bubble of her own: the score with its math. */
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
      {/* The name sits over the bubble, past the avatar's column. */}
      <header className={cn("flex items-baseline gap-2 px-1 text-xs", right ? "flex-row-reverse pr-8" : "pl-8")}>
        <span className={cn("font-medium", sideText(message.seat))}>{name}</span>
        <span className="text-muted-foreground">{t.feed.round(message.round)}</span>
      </header>
      {/* The bubble, with the debater's avatar at the outer edge, in the same column Deb's face takes below. */}
      <div className={cn("flex w-full max-w-[min(100%,40rem)] items-start gap-2", right && "flex-row-reverse")}>
        <Debater className={cn("mt-1.5 size-6 shrink-0", sideText(message.seat))} title={name} />
        <div
          className={cn(
            "w-fit max-w-full rounded-2xl border",
            message.seat === "a" ? "rounded-tl-sm border-side-a/30 bg-side-a/12" : "rounded-tr-sm border-side-b/30 bg-side-b/12",
          )}
        >
          <p className="px-4 py-3 text-base leading-relaxed whitespace-pre-wrap sm:text-[17px]">
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
          </p>
        </div>
      </div>

      {/* Deb answers under the message, in a bubble of her own, from the same side so it reads as a reply to it. */}
      <div className={cn("flex w-full max-w-[min(100%,40rem)] items-start gap-2", right && "flex-row-reverse")}>
        <Deb
          mood={!judgement ? (message.failed ? "stern" : "busy") : score?.manipulation ? "stern" : verdictMood(score?.points ?? 0)}
          className="mt-1.5 size-6 shrink-0 text-bot"
          title={BRAND.bot.name}
        />
        <div className={cn("flex min-w-0 flex-1 items-end gap-1.5 text-sm", right && "flex-row-reverse")}>
          <div className={cn("w-fit max-w-full min-w-0 rounded-2xl border border-bot/25 bg-card", right ? "rounded-tr-sm" : "rounded-tl-sm")}>
            {!judgement && !message.failed && (
              <p className="px-3.5 py-2.5 text-muted-foreground">
                <span className="shimmer">{t.feed.judging}</span>
              </p>
            )}

            {!judgement && message.failed && (
              <p className="flex flex-wrap items-center gap-2 px-3.5 py-2.5 text-destructive">
                {message.failed === "budget" ? t.feed.judgeBudget : t.feed.judgeFailed}
                {canAct && message.failed !== "budget" && (
                  <button type="button" onClick={() => onRetry(message.id)} className="inline-flex items-center gap-1 underline underline-offset-4">
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
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-2.5"
                >
                  {/* The formula with its numbers: points = rubric - penalties. */}
                  <span className="font-mono text-sm tabular-nums" title={t.feed.points(score.points)}>
                    <span className={cn("font-semibold", sideMark(message.seat))}>{signed(score.points)}</span>
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
                        "inline-flex items-center gap-1.5 border border-destructive/50 bg-background px-2 py-1 text-xs text-destructive transition-colors hover:bg-destructive/15",
                        TILTS[index % TILTS.length],
                        openPenalty === index && "bg-destructive/15",
                      )}
                    >
                      <TriangleAlert className="size-3.5" />
                      {t.fallacies[penalty.type].name}
                      <span className="font-mono">{signed(-penalty.points)}</span>
                    </button>
                  ))}

                  {validation && (
                    <StatusTag status={validation.status}>
                      {t.status[validation.status]}
                      {validation.delta !== 0 && <span className="font-mono">{signed(validation.delta)}</span>}
                    </StatusTag>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowRubric((shown) => !shown)}
                    aria-expanded={showRubric}
                    aria-label={t.feed.rubric}
                    title={t.feed.rubric}
                    className="grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <ChevronDown className={cn("size-3.5 transition-transform", showRubric && "rotate-180")} />
                  </button>
                </motion.div>

                {score.manipulation && (
                  <p className="mx-3.5 mb-2.5 inline-flex -rotate-1 items-center gap-2 border border-destructive/50 bg-background px-3 py-1.5 text-destructive">
                    <TriangleAlert className="size-4" />
                    {t.feed.manipulation}
                  </p>
                )}

                {judgement.note && <p className="px-3.5 pb-2.5 text-left text-[15px] leading-relaxed">{judgement.note}</p>}

                {/* Switching from one flag to another folds the first away and unfolds the next. */}
                <AnimatePresence initial={false} mode="wait">
                  {opened && (
                    <Unfold key={openPenalty} className="border-t border-destructive/40 p-3.5 text-left">
                      <p className="eyebrow text-destructive">
                        {t.fallacies[opened.type].name}
                        <span className="ml-3 text-muted-foreground">{t.feed.severity(opened.severity)}</span>
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">{t.fallacies[opened.type].definition}</p>
                      <p className="mt-2 text-[15px]">{judgement.fallacies[opened.index].explanation}</p>
                    </Unfold>
                  )}
                </AnimatePresence>

                <AnimatePresence initial={false}>
                  {showRubric && (
                    <Unfold className="grid grid-cols-2 gap-x-5 gap-y-3 border-t border-border p-3.5 text-left sm:grid-cols-4">
                      {QUALITY_KEYS.map((key) => {
                        const skipped = key === "rebuttal" && message.isOpening;
                        const value = judgement.quality[key];
                        return (
                          <div key={key}>
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="eyebrow text-muted-foreground">{t.quality[key]}</span>
                              <span className="font-mono text-sm tabular-nums">{skipped ? t.feed.notApplicable : value}</span>
                            </div>
                            {/* Ten cells, lit up to the rating. */}
                            <div className="mt-1.5 flex gap-px">
                              {/* The lit cells come on one after another as the rubric opens. */}
                              {Array.from({ length: 10 }, (_, cell) =>
                                !skipped && cell < value ? (
                                  <motion.span
                                    key={cell}
                                    initial={{ opacity: 0.15 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.08 + cell * 0.03, duration: 0.2 }}
                                    className={cn("h-2 flex-1", sideBg(message.seat))}
                                  />
                                ) : (
                                  <span key={cell} className="h-2 flex-1 bg-muted" />
                                ),
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {message.isOpening && <p className="col-span-full text-xs text-muted-foreground">{t.feed.openingNote}</p>}
                    </Unfold>
                  )}
                </AnimatePresence>
              </>
            )}
          </div>

          {/* A claim Deb can check: the reply arrow beside her bubble starts a call to her about this message. */}
          {judgement && score && canAct && !validation && checkable && (
            <button
              type="button"
              onClick={() => onAsk(message.id)}
              aria-label={t.feed.askBot}
              title={t.feed.askBot}
              className="grid size-8 shrink-0 place-items-center rounded-full border border-bot/30 text-bot transition-[background-color,scale] hover:scale-110 hover:bg-bot/10"
            >
              <Reply className={cn("size-4", right && "-scale-x-100")} />
            </button>
          )}
        </div>
      </div>
    </motion.article>
  );
}
