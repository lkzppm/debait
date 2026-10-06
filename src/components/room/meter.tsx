"use client";

import { motion, useSpring, useTransform } from "motion/react";
import { useEffect } from "react";
import { useT } from "@/i18n/LocaleProvider";
import type { DebateState, RoomMeta, Seat } from "@/lib/debate/types";
import { cn } from "@/lib/utils";

const SPRING = { stiffness: 140, damping: 24 };

/** A percentage that counts towards its new value instead of jumping. */
function Percent({ value }: { value: number }) {
  const spring = useSpring(value, SPRING);
  useEffect(() => spring.set(value), [spring, value]);
  const text = useTransform(spring, (current) => `${Math.round(current)}%`);
  return <motion.span>{text}</motion.span>;
}

function Side({ seat, name, stance, percent, active }: { seat: Seat; name: string; stance: string; percent: number; active: boolean }) {
  const right = seat === "b";
  return (
    <div className={cn("flex min-w-0 flex-1 items-baseline gap-3", right && "flex-row-reverse text-right")}>
      <span
        className={cn("font-mono text-3xl font-semibold tabular-nums sm:text-4xl", seat === "a" ? "text-side-a" : "text-side-b")}
      >
        <Percent value={percent} />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 truncate text-sm font-medium sm:text-base">
          {right && active && <TurnDot seat={seat} />}
          <span className="truncate">{name}</span>
          {!right && active && <TurnDot seat={seat} />}
        </span>
        <span className="block truncate text-xs text-muted-foreground">{stance}</span>
      </span>
    </div>
  );
}

function TurnDot({ seat }: { seat: Seat }) {
  return (
    <span className="relative flex size-2 shrink-0">
      <span className={cn("absolute inset-0 animate-ping rounded-full opacity-70", seat === "a" ? "bg-side-a" : "bg-side-b")} />
      <span className={cn("relative size-2 rounded-full", seat === "a" ? "bg-side-a" : "bg-side-b")} />
    </span>
  );
}

/** The meter after each ledger entry: the story of the debate, not only its current state. */
function Timeline({ history, label }: { history: number[]; label: string }) {
  if (history.length < 2) return null;
  const width = 100;
  const height = 22;
  // Zoom on the range the debate actually used, so a 55/45 debate is not a flat line.
  const reach = Math.max(0.12, ...history.map((share) => Math.abs(share - 0.5))) * 1.15;
  const y = (share: number) => (0.5 - (share - 0.5) / (2 * reach)) * height;
  const points = history
    .map((share, index) => `${((index / (history.length - 1)) * width).toFixed(2)},${y(share).toFixed(2)}`)
    .join(" ");
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="mt-2 h-6 w-full overflow-visible"
    >
      <defs>
        <linearGradient id="meter-timeline" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={height}>
          <stop offset="0.35" stopColor="var(--side-a)" />
          <stop offset="0.65" stopColor="var(--side-b)" />
        </linearGradient>
      </defs>
      <line x1="0" x2={width} y1={height / 2} y2={height / 2} stroke="var(--border)" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
      <polyline
        points={points}
        fill="none"
        stroke="url(#meter-timeline)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * The legible meter. The arena behind the page shows the same number as a
 * picture; this is the one to read, and the one assistive technology sees.
 */
export function Meter({ meta, state, names }: { meta: RoomMeta; state: DebateState; names: Record<Seat, string> }) {
  const t = useT();
  const a = Math.round(state.share * 100);
  const b = 100 - a;
  return (
    <section className="panel rounded-2xl px-4 py-3 sm:px-5">
      <div className="flex items-end justify-between gap-4">
        <Side seat="a" name={names.a} stance={meta.stances.a} percent={a} active={state.turn === "a"} />
        <Side seat="b" name={names.b} stance={meta.stances.b} percent={b} active={state.turn === "b"} />
      </div>

      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={a}
        aria-label={t.meter.label(a, b)}
        className="relative mt-3 h-3.5 overflow-hidden rounded-full bg-side-b/85"
      >
        <motion.div
          className="absolute inset-y-0 left-0 bg-side-a"
          initial={false}
          animate={{ width: `${state.share * 100}%` }}
          transition={{ type: "spring", ...SPRING }}
        />
        {/* The frontier: solid when the round is settled, softer while it is provisional. */}
        <motion.div
          className={cn("absolute inset-y-0 w-1 -translate-x-1/2 bg-white", state.provisional ? "opacity-50" : "shadow-[0_0_12px_2px_white]")}
          initial={false}
          animate={{ left: `${state.share * 100}%` }}
          transition={{ type: "spring", ...SPRING }}
        />
        <div className="absolute inset-y-0 left-1/2 w-px bg-background/60" />
      </div>

      <div className="mt-1.5 flex h-4 items-center justify-center text-[11px] tracking-wide text-muted-foreground uppercase">
        {state.provisional && <span title={t.meter.provisionalHint}>{t.meter.provisional}</span>}
      </div>

      <Timeline history={state.history} label={t.meter.timeline} />
    </section>
  );
}
