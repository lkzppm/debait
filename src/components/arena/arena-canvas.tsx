"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { SIDE_COLORS } from "@/lib/brand";
import { cn } from "@/lib/utils";
import type { ArenaState } from "./arena";

export interface ArenaCanvasProps {
  /** Share of side A, 0..1: where the frontier sits (0.5 is the centre). */
  share: number;
  /** Increment to fire an impact pulse; `pulseDir` says who gained (1 = side A, -1 = side B). */
  pulse?: number;
  pulseDir?: 1 | -1;
  /** Increment to fire a glitch pulse (a fallacy or a manipulation flag). */
  glitch?: number;
  /** The round is incomplete: draw the frontier softer. */
  provisional?: boolean;
  /** Ink strength 0..1: low behind text, higher on the landing page. Default 0.6. */
  intensity?: number;
  className?: string;
}

const BACKGROUND = "#0B0B10";
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

const noop = () => {};
const subscribeNever = () => noop;

function subscribeReducedMotion(listener: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * The debate's background: two colours pressing against each other, with the
 * frontier where the meter is (WebGPU via vgpu). Without WebGPU, when it
 * fails to start, or when the visitor asked for reduced motion, the same
 * idea is drawn with CSS gradients. Decorative only: the DOM meter is what
 * people (and screen readers) read the score from.
 */
export function ArenaCanvas({
  share,
  pulse = 0,
  pulseDir = 1,
  glitch = 0,
  provisional = false,
  intensity = 0.6,
  className,
}: ArenaCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hasWebGpu = useSyncExternalStore(
    subscribeNever,
    () => "gpu" in navigator,
    () => true,
  );
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
  const [initFailed, setInitFailed] = useState(false);
  const fallback = !hasWebGpu || reducedMotion || initFailed;

  // The frame loop reads the latest props from here, so a new score never
  // restarts the GPU.
  const stateRef = useRef<ArenaState>({ share, pulse, pulseDir, glitch, provisional, intensity });
  useEffect(() => {
    stateRef.current = { share, pulse, pulseDir, glitch, provisional, intensity };
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || fallback) return;
    let dispose: (() => void) | undefined;
    let cancelled = false;
    import("./arena").then(({ startArena }) => {
      if (cancelled) return;
      dispose = startArena({
        canvas,
        getState: () => stateRef.current,
        onError: (error) => {
          console.warn("[arena] WebGPU failed, using the CSS fallback", error);
          setInitFailed(true);
        },
      });
    });
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [fallback]);

  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      {fallback ? (
        <ArenaFallback share={share} provisional={provisional} intensity={intensity} animate={!reducedMotion} />
      ) : (
        <canvas ref={canvasRef} className="block h-full w-full" />
      )}
    </div>
  );
}

/** Static stand-in for the shader: each side is a glow anchored on the frontier. */
function ArenaFallback({
  share,
  provisional,
  intensity,
  animate,
}: {
  share: number;
  provisional: boolean;
  intensity: number;
  animate: boolean;
}) {
  const at = clamp01(share) * 100;
  const ink = clamp01(intensity);
  const transition = animate ? "width 800ms cubic-bezier(0.16, 1, 0.3, 1), left 800ms cubic-bezier(0.16, 1, 0.3, 1)" : "none";
  // Two-digit hex alpha appended to the side colour.
  const alpha = (value: number) =>
    Math.round(clamp01(value) * 255)
      .toString(16)
      .padStart(2, "0");

  return (
    <div style={{ position: "absolute", inset: 0, background: BACKGROUND }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: `${at}%`,
          background: `radial-gradient(ellipse 95% 75% at 100% 50%, ${SIDE_COLORS.a}${alpha(0.42 * ink)}, transparent 72%)`,
          transition,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          right: 0,
          width: `${100 - at}%`,
          background: `radial-gradient(ellipse 95% 75% at 0% 50%, ${SIDE_COLORS.b}${alpha(0.42 * ink)}, transparent 72%)`,
          transition,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: `${at}%`,
          width: provisional ? 6 : 2,
          transform: "translateX(-50%)",
          background: "linear-gradient(to bottom, transparent, rgba(255, 255, 255, 0.55), transparent)",
          opacity: (provisional ? 0.3 : 0.7) * ink,
          filter: provisional ? "blur(3px)" : "blur(0.5px)",
          transition,
        }}
      />
    </div>
  );
}
