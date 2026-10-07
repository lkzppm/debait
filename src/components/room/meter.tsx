"use client";

import { motion, useSpring, useTransform } from "motion/react";
import { useEffect } from "react";
import { CubesBand } from "@/components/cubes/cubes-canvas";
import { useT } from "@/i18n/LocaleProvider";
import type { DebateState, RoomMeta, Seat } from "@/lib/debate/types";
import { cn } from "@/lib/utils";

const SPRING = { stiffness: 140, damping: 24 };

/** A percentage that counts towards its new value instead of jumping. */
function Percent({ value }: { value: number }) {
  const spring = useSpring(value, SPRING);
  useEffect(() => spring.set(value), [spring, value]);
  const text = useTransform(spring, (current) => `${Math.round(current)}`);
  return <motion.span>{text}</motion.span>;
}

function Side({ seat, label, name, stance, percent, active }: { seat: Seat; label: string; name: string; stance: string; percent: number; active: boolean }) {
  const right = seat === "b";
  const tone = seat === "a" ? "text-side-a" : "text-side-b";
  return (
    <div className={cn("flex min-w-0 flex-1 items-end gap-4", right && "flex-row-reverse text-right")}>
      <p className={cn("font-medium tracking-tighter tabular-nums", tone)}>
        <span className="text-4xl sm:text-5xl">
          <Percent value={percent} />
        </span>
        <span className="text-xl sm:text-2xl">%</span>
      </p>
      <div className="min-w-0 pb-1.5">
        <p className={cn("eyebrow flex items-center gap-2", tone, right && "flex-row-reverse")}>
          {label}
          {/* A blinking cell marks whose turn it is. */}
          {active && <span className={cn("size-2 animate-pulse", seat === "a" ? "bg-side-a" : "bg-side-b")} />}
        </p>
        <p className="truncate text-base font-medium sm:text-lg">{name}</p>
        <p className="truncate text-xs text-muted-foreground sm:text-sm">{stance}</p>
      </div>
    </div>
  );
}

interface MeterProps {
  meta: RoomMeta;
  state: DebateState;
  names: Record<Seat, string>;
  /** Forwarded to the mosaic so it reacts to score changes and flags. */
  pulse: number;
  pulseDir: 1 | -1;
  glitch: number;
}

/**
 * The meter: a pixel mosaic split between the two colours where the score
 * is, with the numbers to read above it. The numbers and the `meter` role
 * are the source of truth; the mosaic is the picture of them.
 */
export function Meter({ meta, state, names, pulse, pulseDir, glitch }: MeterProps) {
  const t = useT();
  const a = Math.round(state.share * 100);
  const b = 100 - a;
  return (
    <section className="panel px-4 py-4 sm:px-6">
      <div className="flex items-end justify-between gap-4">
        <Side seat="a" label={t.meter.side("A")} name={names.a} stance={meta.stances.a} percent={a} active={state.turn === "a"} />
        <Side seat="b" label={t.meter.side("B")} name={names.b} stance={meta.stances.b} percent={b} active={state.turn === "b"} />
      </div>

      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={a}
        aria-label={t.meter.label(a, b)}
        className="relative mt-3 h-9 overflow-hidden border border-border sm:h-10"
      >
        <CubesBand share={state.share} pulse={pulse} pulseDir={pulseDir} glitch={glitch} provisional={state.provisional} rows={3} />
      </div>

      {state.provisional && (
        <p className="eyebrow mt-2 text-center text-muted-foreground" title={t.meter.provisionalHint}>
          {t.meter.provisional}
        </p>
      )}
    </section>
  );
}
