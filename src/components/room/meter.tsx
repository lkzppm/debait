"use client";

import { Trophy } from "lucide-react";
import { motion, useSpring, useTransform } from "motion/react";
import { useEffect } from "react";
import { CubesBand } from "@/components/cubes/cubes-canvas";
import { Deb } from "@/components/site/deb";
import { useT } from "@/i18n/LocaleProvider";
import type { DebateState, RoomMeta, Seat } from "@/lib/debate/types";
import { cn } from "@/lib/utils";

const SPRING = { stiffness: 140, damping: 24 };

/** The pixels the result bursts into: fixed angles and distances, so every screen draws the same burst. */
const BURST = Array.from({ length: 22 }, (_, index) => {
  const angle = (index / 22) * Math.PI * 2 + ((index * 37) % 11) / 20;
  const distance = 70 + ((index * 53) % 7) * 18;
  return { x: Math.cos(angle) * distance * 1.6, y: Math.sin(angle) * distance * 0.7, size: 5 + ((index * 29) % 3) * 2, delay: ((index * 13) % 5) * 0.03 };
});

/** A percentage that counts towards its new value instead of jumping. */
function Percent({ value }: { value: number }) {
  const spring = useSpring(value, SPRING);
  useEffect(() => spring.set(value), [spring, value]);
  const text = useTransform(spring, (current) => `${Math.round(current)}`);
  return <motion.span>{text}</motion.span>;
}

function Side({ seat, name, stance, percent, active, won }: { seat: Seat; name: string; stance: string; percent: number; active: boolean; won: boolean }) {
  const right = seat === "b";
  const tone = seat === "a" ? "text-side-a" : "text-side-b";
  return (
    <div className={cn("flex min-w-0 flex-1 items-end gap-2 sm:gap-4", right && "flex-row-reverse text-right")}>
      {/* The winner's number jumps when the debate ends. */}
      <motion.p
        animate={won ? { scale: [1, 1.3, 0.95, 1.08, 1] } : { scale: 1 }}
        transition={{ duration: 0.9, delay: 0.35, ease: "easeOut" }}
        className={cn("font-medium tracking-tighter tabular-nums", tone, right ? "origin-right" : "origin-left")}
      >
        <span className="text-3xl sm:text-5xl">
          <Percent value={percent} />
        </span>
        <span className="text-lg sm:text-2xl">%</span>
      </motion.p>
      <div className="min-w-0 pb-1">
        <p className={cn("flex items-center gap-2 text-sm font-medium sm:text-lg", right && "flex-row-reverse")}>
          <span className="truncate">{name}</span>
          {/* A blinking cell marks whose turn it is. */}
          {active && <span className={cn("size-2 shrink-0 animate-pulse", seat === "a" ? "bg-side-a" : "bg-side-b")} />}
        </p>
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
  /** Opens the full result; once the debate is over, the brief result on the band calls it. */
  onResult?: () => void;
}

/**
 * The meter: a pixel mosaic split between the two colours where the score
 * is, with the numbers to read above it. The numbers and the `meter` role
 * are the source of truth; the mosaic is the picture of them.
 */
export function Meter({ meta, state, names, pulse, pulseDir, glitch, onResult }: MeterProps) {
  const t = useT();
  const a = Math.round(state.share * 100);
  const b = 100 - a;
  const winner = state.status === "finished" ? state.winner : null;
  return (
    <section className="panel px-3 py-3 sm:px-6 sm:py-4">
      <div className="flex items-end justify-between gap-3 sm:gap-4">
        <Side seat="a" name={names.a} stance={meta.stances.a} percent={a} active={state.turn === "a"} won={winner === "a"} />
        <Side seat="b" name={names.b} stance={meta.stances.b} percent={b} active={state.turn === "b"} won={winner === "b"} />
      </div>

      {/* The band, and over it what is left to say: "provisional" while the round is open, the result at the end. */}
      <div className="relative mt-2.5 sm:mt-3">
        <div
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={a}
          aria-label={t.meter.label(a, b)}
          className="relative h-8 overflow-hidden border border-border sm:h-10"
        >
          <CubesBand share={state.share} pulse={pulse} pulseDir={pulseDir} glitch={glitch} provisional={state.provisional} rows={3} />
          {state.provisional && (
            <span
              className="eyebrow absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background/85 px-2 py-0.5 text-muted-foreground"
              title={t.meter.provisionalHint}
            >
              {t.meter.provisional}
            </span>
          )}
        </div>

        {winner && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            {/* Pixels in the winner's colour (both colours on a draw) burst out of the middle once. */}
            {BURST.map((pixel, index) => (
              <motion.span
                key={index}
                aria-hidden
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{ x: pixel.x, y: pixel.y, opacity: 0, scale: 0.4, rotate: 90 }}
                transition={{ duration: 1.1, delay: 0.25 + pixel.delay, ease: [0.16, 1, 0.3, 1] }}
                style={{ width: pixel.size, height: pixel.size }}
                className={cn("absolute", (winner === "draw" ? index % 2 === 0 : winner === "a") ? "bg-side-a" : "bg-side-b")}
              />
            ))}
          </div>
        )}

        {/* Deb shows off: she pops up from the middle of the band holding a sign with the winner's name.
            The sign opens the full result. */}
        {winner && (
          <motion.div
            initial={{ y: 28, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 14, delay: 0.45 }}
            className="absolute bottom-[calc(100%-0.5rem)] left-1/2 z-10 flex -translate-x-1/2 flex-col items-center"
          >
            {/* A little bounce after landing, three times, then she holds still. */}
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 0.45, delay: 1, repeat: 3, ease: "easeOut" }}
              className="flex flex-col items-center"
            >
              <motion.button
                type="button"
                onClick={onResult}
                disabled={!onResult}
                aria-haspopup="dialog"
                title={t.result.open}
                animate={{ rotate: [-4, 4, -4] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                className={cn(
                  "inline-flex items-center gap-1.5 border-2 bg-background px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap shadow-lg shadow-black/25 transition-colors hover:bg-accent sm:px-3 sm:py-1 sm:text-sm",
                  winner === "a" ? "border-side-a text-side-a" : winner === "b" ? "border-side-b text-side-b" : "border-foreground text-foreground",
                )}
              >
                <Trophy className="size-3.5 sm:size-4" />
                {winner === "draw" ? t.result.draw : t.result.wins(names[winner])}
              </motion.button>
              {/* The two sticks she holds the sign by. */}
              <span aria-hidden className="flex w-5 justify-between sm:w-6">
                <span className="h-1.5 w-0.5 bg-bot sm:h-2" />
                <span className="h-1.5 w-0.5 bg-bot sm:h-2" />
              </span>
              <Deb mood="good" className="size-6 text-bot sm:size-7" />
            </motion.div>
          </motion.div>
        )}
      </div>
    </section>
  );
}
