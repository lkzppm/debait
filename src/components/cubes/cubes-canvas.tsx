"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import type { CubesLayout, CubesState } from "./cubes";

export interface CubesProps {
  /** Share of side A, 0..1: side A (purple) owns the left of the frontier, side B (green) the right. */
  share: number;
  /** Increment to fire an impact pulse; `pulseDir` says who gained (1 = side A, -1 = side B). */
  pulse?: number;
  pulseDir?: 1 | -1;
  /** Increment to fire a glitch pulse (a fallacy or a manipulation flag). */
  glitch?: number;
  /** The round is incomplete: the frontier cells blink instead of standing firm. */
  provisional?: boolean;
  /** Overall strength 0..1. */
  intensity?: number;
  className?: string;
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
// The fallbacks take their colours from the theme's custom properties, so
// they follow the light and the dark page with no script.
/** Same grid line as the shader: the text colour, faint, one pixel wide. */
const LINE = "color-mix(in srgb, var(--foreground) 10%, transparent)";
/** The four flat shades of the mosaic, as in the shader. */
const SHADES = [0.42, 0.61, 0.81, 1];

const noop = () => {};
const subscribeNever = () => noop;

function subscribeReducedMotion(listener: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

// All canvases share one GPU device, so when it cannot start they all fall
// back together, and canvases mounted later do not try again.
let gpuFailed = false;
const failureListeners = new Set<() => void>();

function subscribeFailure(listener: () => void) {
  failureListeners.add(listener);
  return () => failureListeners.delete(listener);
}

function reportFailure(error: unknown) {
  if (gpuFailed) return;
  gpuFailed = true;
  console.warn("[cubes] WebGPU failed, using the fallback", error);
  failureListeners.forEach((listener) => listener());
}

/**
 * Starts the shader on a canvas and says when to draw the fallback instead:
 * no WebGPU, a failed start, or a visitor who asked for reduced motion.
 */
function useCubes(layout: CubesLayout, state: CubesState) {
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
  const initFailed = useSyncExternalStore(
    subscribeFailure,
    () => gpuFailed,
    () => false,
  );
  const fallback = !hasWebGpu || reducedMotion || initFailed;

  // The frame loop reads the latest props from here, so a new score never
  // restarts the GPU.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const kind = layout.kind;
  const size = layout.kind === "field" ? layout.cell : layout.rows;
  const neutral = layout.kind === "band" && layout.neutral;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || fallback) return;
    let dispose: (() => void) | undefined;
    let cancelled = false;
    import("./cubes").then(({ mountCubes }) => {
      if (cancelled) return;
      dispose = mountCubes({
        canvas,
        layout: kind === "field" ? { kind, cell: size } : { kind, rows: size, neutral },
        getState: () => stateRef.current,
        onError: reportFailure,
      });
    });
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [fallback, kind, size, neutral]);

  return { canvasRef, fallback, reducedMotion };
}

function toState(props: CubesProps, defaultIntensity: number): CubesState {
  return {
    share: props.share,
    pulse: props.pulse ?? 0,
    pulseDir: props.pulseDir ?? 1,
    glitch: props.glitch ?? 0,
    provisional: props.provisional ?? false,
    intensity: props.intensity ?? defaultIntensity,
  };
}

/**
 * The page background, in the theme's colours: a thin grid out of which
 * cells rise as small cubes, purple on side A's ground and green on side B's,
 * crowding and capturing each other at the frontier, over a dithered glow;
 * the pointer and clicks send rings through them (WebGPU via vgpu). The
 * fallback keeps the grid and drops the cubes. Decorative only: the DOM meter
 * is what people read the score from.
 */
export function CubesField(props: CubesProps & { cell?: number }) {
  const cell = props.cell ?? 34;
  const { canvasRef, fallback } = useCubes({ kind: "field", cell }, toState(props, 0.8));
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", props.className)} aria-hidden>
      {fallback ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "var(--background)",
            backgroundImage: `linear-gradient(to right, ${LINE} 1px, transparent 1px), linear-gradient(to bottom, ${LINE} 1px, transparent 1px)`,
            backgroundSize: `${cell}px ${cell}px`,
          }}
        />
      ) : (
        <canvas ref={canvasRef} className="block h-full w-full" />
      )}
    </div>
  );
}

/**
 * A dense pixel mosaic filling its container: purple shades up to the share,
 * green shades after it (WebGPU via vgpu), or greys with `tone="neutral"`,
 * all mixed from the theme's colours.
 * The fallback draws the same split with plain elements.
 */
export function CubesBand(props: CubesProps & { rows?: number; tone?: "sides" | "neutral" }) {
  const rows = Math.max(1, Math.round(props.rows ?? 3));
  const neutral = props.tone === "neutral";
  const { canvasRef, fallback, reducedMotion } = useCubes({ kind: "band", rows, neutral }, toState(props, 1));
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", props.className)} aria-hidden>
      {fallback ? (
        <BandFallback
          share={props.share}
          rows={rows}
          neutral={neutral}
          provisional={props.provisional ?? false}
          intensity={props.intensity ?? 1}
          animate={!reducedMotion}
        />
      ) : (
        <canvas ref={canvasRef} className="block h-full w-full" />
      )}
    </div>
  );
}

/** A stable pseudo-random number in 0..1 for a cell, so the mosaic never reshuffles on render. */
function cellNoise(column: number, row: number, salt: number): number {
  let value = (Math.imul(column + 1, 0x9e3779b1) ^ Math.imul(row + 1, 0x85ebca6b) ^ Math.imul(salt + 1, 0xc2b2ae35)) | 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

/** A colour at `amount` (0..1) over the page's background, as the shader mixes it. */
function over(color: string, amount: number): string {
  return `color-mix(in srgb, ${color} ${Math.round(amount * 100)}%, var(--background))`;
}

/** The neutral mosaic: greys between the page and the text colour. */
function neutralShade(shade: number): string {
  return over("var(--foreground)", 0.08 + 0.26 * ((shade - SHADES[0]) / (1 - SHADES[0])));
}

/** The mosaic without WebGPU: a grid of square cells, coloured by the share. */
function BandFallback({
  share,
  rows,
  neutral,
  provisional,
  intensity,
  animate,
}: {
  share: number;
  rows: number;
  neutral: boolean;
  provisional: boolean;
  intensity: number;
  animate: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Columns needed for square cells; unknown until the container is measured.
  const [columns, setColumns] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setColumns(height > 0 ? Math.min(240, Math.ceil(width / (height / rows))) : 0);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [rows]);

  const front = clamp01(share) * columns;
  const frontColumn = Math.floor(front);
  const cells = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const shade = SHADES[Math.floor(cellNoise(column, row, 7) * SHADES.length)];
      // The frontier column goes to side A in proportion to how far the share reaches into it.
      const isA = column < frontColumn || (column === frontColumn && cellNoise(column, row, 31) < front - frontColumn);
      const dim = !neutral && provisional && column === frontColumn ? 0.62 : 1;
      const color = neutral ? neutralShade(shade) : over(isA ? "var(--side-a)" : "var(--side-b)", shade * dim);
      cells.push(
        <div key={`${row}-${column}`} style={{ backgroundColor: color, transition: animate ? "background-color 600ms ease" : "none" }} />,
      );
    }
  }

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        gridTemplateColumns: `repeat(${Math.max(1, columns)}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        opacity: 0.35 + 0.65 * clamp01(intensity),
        // Before the first measurement: the plain split, so the meter is never blank.
        background: neutral
          ? neutralShade(SHADES[2])
          : `linear-gradient(to right, var(--side-a) ${clamp01(share) * 100}%, var(--side-b) ${clamp01(share) * 100}%)`,
      }}
    >
      {cells}
    </div>
  );
}
