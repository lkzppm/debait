"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { CubesBand } from "@/components/cubes/cubes-canvas";
import { StatusTag } from "@/components/room/message-item";
import { useT } from "@/i18n/LocaleProvider";
import { BRAND, MENTION } from "@/lib/brand";
import { FALLACY_UNIT, meterShare, scoreMessage, VALIDATION_DELTA } from "@/lib/debate/scoring";
import { QUALITY_KEYS, type Judgement, type Quality } from "@/lib/debate/types";
import { cn } from "@/lib/utils";
import { Deb } from "./deb";

/* One short debate (two messages and a call to the bot) shown the four ways
   the room shows it: the chat, the ledger, the bot's terminal and the meter.
   A step is in focus at a time and every piece follows it. The focus walks
   the steps on its own, follows the pointer on the step buttons, and only
   pauses while the pointer is over them. The
   numbers are not typed in: they come out of the same scoring code the
   room uses. */

const NAMES = { a: "Ana", b: "Bia" };

const OBSERVED = { claims: [], manipulation: false, note: "", summary: "" };
/** What a judge could observe in the opening message (rebuttal does not apply). */
const FIRST: Judgement = { ...OBSERVED, quality: { logic: 8, evidence: 8, rebuttal: 0, clarity: 7 }, fallacies: [] };
const SECOND_QUALITY: Quality = { logic: 4, evidence: 3, rebuttal: 5, clarity: 6 };
const SEVERITY = 2;

/** The steps, and how long the focus rests on each (milliseconds). */
const STEPS = ["argue", "scored", "attack", "flagged", "call", "checked"] as const;
const REST = [2000, 2800, 2200, 3200, 2600, 4600];
const LAST = STEPS.length - 1;

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
function subscribeReducedMotion(listener: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

/** Appears in place when `shown`, and keeps its room while hidden so nothing jumps. */
function Appear({ shown, className, children }: { shown: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div
      aria-hidden={!shown}
      className={cn("transition-[opacity,translate] duration-500 ease-out-expo", shown ? "opacity-100" : "translate-y-2 opacity-0", className)}
    >
      {children}
    </div>
  );
}

function Piece({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="eyebrow mb-3 flex items-center gap-2 text-muted-foreground">
        <span className="size-1.5 bg-current" />
        {label}
      </p>
      {children}
    </div>
  );
}

export function Demo() {
  const t = useT();
  const d = t.home.demo;
  const reduced = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
  // `step` is null until the walk or the visitor moves it: with reduced motion
  // the figure then rests on its last step, complete.
  const [walk, setWalk] = useState<{ step: number | null; pulse: number; dir: 1 | -1; glitch: number }>({
    step: null,
    pulse: 0,
    dir: 1,
    glitch: 0,
  });
  const [hovered, setHovered] = useState(false);
  const step = walk.step ?? (reduced ? LAST : 0);

  const [before, flagged, after] = d.second;
  const scoreA = scoreMessage(d.first, FIRST, true);
  const scoreB = scoreMessage(
    before + flagged + after,
    { ...OBSERVED, quality: SECOND_QUALITY, fallacies: [{ type: "ad_hominem", quote: flagged, explanation: "", severity: SEVERITY, confidence: 0.9 }] },
    false,
  );
  const bonus = VALIDATION_DELTA.confirmed;
  // Side A's share of the meter at each step.
  const afterA = meterShare(scoreA.points, 0);
  const afterB = meterShare(scoreA.points, scoreB.points);
  const shares = [0.5, afterA, afterA, afterB, afterB, meterShare(scoreA.points + bonus, scoreB.points)];
  const share = shares[step];
  const percent = Math.round(share * 100);

  const go = (next: number) =>
    setWalk((current) => {
      const from = current.step ?? 0;
      if (from === next && current.step !== null) return current;
      const moved = shares[next] !== shares[from];
      return {
        step: next,
        pulse: current.pulse + (moved ? 1 : 0),
        dir: moved ? (shares[next] > shares[from] ? 1 : -1) : current.dir,
        // The mosaic flickers when the fallacy is flagged.
        glitch: current.glitch + (STEPS[next] === "flagged" ? 1 : 0),
      };
    });

  useEffect(() => {
    if (hovered || reduced) return;
    const id = setTimeout(() => go((step + 1) % STEPS.length), REST[step]);
    return () => clearTimeout(id);
    // `go` only reads the shares, which follow the language.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, hovered, reduced]);

  const captions = [
    d.steps.argue(NAMES.a),
    d.steps.scored(scoreA.points),
    d.steps.attack(NAMES.b),
    d.steps.flagged(t.fallacies.ad_hominem.name, scoreB.penalty),
    d.steps.call(NAMES.b),
    d.steps.checked(bonus, NAMES.a),
  ];

  // The rubric shown is the last judged message's.
  const rubric = step >= 3 ? SECOND_QUALITY : step >= 1 ? FIRST.quality : null;
  const opening = step < 3;

  return (
    <figure aria-label={d.title}>
      <div className="grid gap-x-12 gap-y-8 sm:gap-y-10 lg:grid-cols-2">
        <Piece label={d.chat} className="lg:row-span-2">
          <div className="flex flex-col gap-3">
            <Appear shown className="w-[92%] border border-l-2 border-border border-l-side-a bg-card p-4">
              <p className="text-xs">
                <span className="mark-a">{NAMES.a}</span>
              </p>
              <p className="mt-2 leading-relaxed">{d.first}</p>
              <p className="mt-3 h-6 font-mono text-sm">
                {step === 0 ? <span className="shimmer">{t.feed.judging}</span> : <span className="mark-a">+{scoreA.points}</span>}
              </p>
            </Appear>

            <Appear shown={step >= 2} className="ml-auto w-[92%] border border-r-2 border-border border-r-side-b bg-card p-4">
              <p className="text-right text-xs">
                <span className="mark-b">{NAMES.b}</span>
              </p>
              <p className="mt-2 leading-relaxed">
                {before}
                <span className={cn("transition-colors duration-500", step >= 3 && "excerpt cursor-default")}>{flagged}</span>
                {after}
              </p>
              <div className="mt-3 flex h-7 items-center gap-3 font-mono text-sm">
                {step === 2 ? (
                  <span className="shimmer">{t.feed.judging}</span>
                ) : (
                  <>
                    <span className="mark-b">+{scoreB.points}</span>
                    <span className="demo-flag inline-flex items-center gap-1.5 border border-destructive/50 bg-background px-2 py-0.5 font-sans text-destructive">
                      <TriangleAlert className="size-3.5" />
                      {t.fallacies.ad_hominem.name} −{FALLACY_UNIT * SEVERITY}
                    </span>
                  </>
                )}
              </div>
            </Appear>

            {/* The call to the bot, as the room draws it: a terminal. */}
            <Appear shown={step >= 4} className="border border-border bg-popover">
              <div className="flex items-center gap-3 border-b border-border px-4 py-2 font-mono text-xs text-muted-foreground">
                <span className="flex gap-1.5" aria-hidden>
                  <span className="size-2.5 rounded-full bg-destructive" />
                  <span className="size-2.5 rounded-full bg-warning" />
                  <span className="size-2.5 rounded-full bg-side-b" />
                </span>
                <Deb mood={step === 4 ? "busy" : "idle"} className="size-4 text-bot" />
                <span className="min-w-0 flex-1 truncate">
                  {BRAND.bot.handle}@{BRAND.name.toLowerCase()}
                </span>
                <span className="uppercase">{step === 4 ? t.bot.state.working : t.bot.state.done}</span>
              </div>
              <div className="flex min-h-32 flex-col gap-2 px-4 py-3 font-mono text-sm">
                <p>
                  <span className="text-side-b">{NAMES.b} $</span> {MENTION} {d.ask}
                </p>
                {step === 4 && (
                  <p className="text-muted-foreground">
                    <span className="shimmer">{t.bot.searching}</span> <span className="caret" />
                  </p>
                )}
                <Appear shown={step >= 5} className="flex flex-col gap-2">
                  <p className="flex flex-wrap items-center gap-2 font-sans">
                    <StatusTag status="confirmed">{t.status.confirmed}</StatusTag>
                    <span>{d.answer}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    [1] <span className="text-side-a underline decoration-side-a/40 underline-offset-4">{d.source}</span>
                  </p>
                </Appear>
              </div>
            </Appear>
          </div>
        </Piece>

        <Piece label={d.score}>
          <ol className="flex flex-col font-mono text-sm">
            <LedgerRow shown={step >= 1} seat="a" delta={scoreA.points} name={NAMES.a} math={`${t.feed.rubric} ${scoreA.base}`} />
            <LedgerRow
              shown={step >= 3}
              seat="b"
              delta={scoreB.points}
              name={NAMES.b}
              math={`${scoreB.base} − ${scoreB.penalty} · ${t.fallacies.ad_hominem.name}`}
            />
            <LedgerRow shown={step >= 5} seat="a" delta={bonus} name={NAMES.a} math={`${MENTION} · ${t.panel.factCheck}`} />
          </ol>

          <dl className="mt-6 grid grid-cols-[auto_minmax(0,1fr)_2.5rem] items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
            {QUALITY_KEYS.map((key) => {
              const skipped = key === "rebuttal" && opening;
              const value = rubric && !skipped ? rubric[key] : 0;
              return (
                <div key={key} className="contents">
                  <dt>{t.quality[key]}</dt>
                  <dd className="h-2 bg-muted">
                    <div
                      className={cn("h-full transition-[width,background-color] duration-700 ease-out-expo", step >= 3 ? "bg-side-b" : "bg-side-a")}
                      style={{ width: `${value * 10}%` }}
                    />
                  </dd>
                  <dd className="text-right font-mono tabular-nums">{skipped ? t.feed.notApplicable : rubric ? value : ""}</dd>
                </div>
              );
            })}
          </dl>
        </Piece>

        <Piece label={d.meter}>
          <div className="flex items-end justify-between gap-4">
            <p className="flex items-baseline gap-3">
              <span className="mark-a text-xs">{NAMES.a}</span>
              <span className="text-4xl leading-none font-medium tracking-tighter tabular-nums sm:text-5xl">{percent}%</span>
            </p>
            <p className="flex items-baseline gap-3">
              <span className="text-4xl leading-none font-medium tracking-tighter tabular-nums sm:text-5xl">{100 - percent}%</span>
              <span className="mark-b text-xs">{NAMES.b}</span>
            </p>
          </div>
          <div className="relative mt-4 h-14 overflow-hidden border border-border">
            <CubesBand share={share} pulse={walk.pulse} pulseDir={walk.dir} glitch={walk.glitch} rows={3} />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{d.note}</p>
        </Piece>
      </div>

      {/* The steps: one square each, and what is happening in words. */}
      <figcaption className="mt-10 flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center">
        <span className="flex gap-1.5" onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)}>
          {STEPS.map((id, index) => (
            <button
              key={id}
              type="button"
              aria-label={captions[index]}
              aria-current={index === step ? "step" : undefined}
              onPointerEnter={() => go(index)}
              onFocus={() => go(index)}
              onClick={() => go(index)}
              className="group grid size-8 place-items-center outline-none"
            >
              <span
                className={cn(
                  "size-3.5 transition-[background-color,scale] duration-300 group-hover:scale-125 group-focus-visible:ring-2 group-focus-visible:ring-ring",
                  index === step ? "scale-125 bg-foreground" : index < step ? "bg-muted-foreground/60" : "bg-border",
                )}
              />
            </button>
          ))}
        </span>
        <p className="min-h-6 font-mono text-sm">
          <span className="mr-3 text-muted-foreground">
            {String(step + 1).padStart(2, "0")}/{String(STEPS.length).padStart(2, "0")}
          </span>
          {captions[step]}
        </p>
      </figcaption>
    </figure>
  );
}

function LedgerRow({ shown, seat, delta, name, math }: { shown: boolean; seat: "a" | "b"; delta: number; name: string; math: string }) {
  return (
    <li
      aria-hidden={!shown}
      className={cn(
        "flex items-center gap-3 border-b border-border py-2.5 transition-[opacity,translate] duration-500 ease-out-expo",
        shown ? "opacity-100" : "-translate-x-2 opacity-0",
      )}
    >
      <span className={cn("w-12 text-center", seat === "a" ? "mark-a" : "mark-b")}>+{delta}</span>
      <span className="font-sans">{name}</span>
      <span className="ml-auto truncate text-xs text-muted-foreground">{math}</span>
    </li>
  );
}
