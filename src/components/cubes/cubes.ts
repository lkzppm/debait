import { clock, effect, frameLoop, init, surface } from "vgpu";
import type { FrameLoopHandle } from "vgpu";
import cubesShader from "./cubes.wgsl";

/** What a canvas of cubes should be showing; read every frame, eased toward here. */
export interface CubesState {
  /** Share of side A, 0..1. */
  share: number;
  /** Counter: a change fires an impact pulse in the direction of `pulseDir`. */
  pulse: number;
  pulseDir: 1 | -1;
  /** Counter: a change fires a glitch pulse. */
  glitch: number;
  provisional: boolean;
  /** Overall strength, 0..1. */
  intensity: number;
}

/** The two things the shader draws: the page-wide grid, or a dense mosaic strip. */
export type CubesLayout =
  | { kind: "field"; /** Cell side in CSS pixels. */ cell: number }
  | { kind: "band"; /** Cells per column; cells stay square. */ rows: number; neutral: boolean };

export interface CubesOptions {
  canvas: HTMLCanvasElement;
  layout: CubesLayout;
  getState: () => CubesState;
  onError?: (error: unknown) => void;
}

/** Fraction of the remaining distance covered per frame at 60 fps. */
const EASE_PER_FRAME = 0.05;
/** The pointer highlight follows faster than the meter. */
const POINTER_EASE_PER_FRAME = 0.18;
/** Seconds an impact pulse takes to fade. */
const IMPACT_SECONDS = 1.1;
/** Seconds a glitch pulse takes to fade. */
const GLITCH_SECONDS = 0.7;
/**
 * The noise loses precision when its time axis grows without bound, so the
 * shader's clock runs forward and back over this many seconds instead.
 */
const TIME_PERIOD = 1800;
/** What the shader is told when nobody has clicked: long enough for a ring to be gone. */
const NO_CLICK_SECONDS = 100;

type Rgba = [number, number, number, number];

/** The theme's colours, as the shader takes them: sRGB 0..1. */
interface Palette {
  dark: boolean;
  colorA: Rgba;
  colorB: Rgba;
  background: Rgba;
  foreground: Rgba;
}

/** What the dark theme holds, for a page whose stylesheet has not arrived yet. */
const DEFAULT_COLORS = { a: "#b44dff", b: "#2ee6d6", background: "#07060e", foreground: "#eceaf6" };

type Gpu = Awaited<ReturnType<typeof init>>;

/** One canvas registered with the shared device, with its own eased state. */
interface View {
  options: CubesOptions;
  surface: ReturnType<typeof surface>;
  fx: ReturnType<typeof effect>;
  share: number;
  provisional: number;
  intensity: number;
  impact: number;
  glitch: number;
  seenPulse: number;
  seenGlitch: number;
  /** The palette this view last sent to the GPU. */
  seenPalette: Palette | null;
  pointer: [number, number];
}

interface Shared {
  gpu: Gpu;
  loop: FrameLoopHandle;
  views: Set<View>;
  /** Replaced by a new object whenever the theme changes. */
  palette: Palette;
  stopListening: () => void;
}

// A page holds one field and a few bands. They share one device and one frame
// loop, created with the first canvas and released with the last.
let shared: Promise<Shared> | null = null;
let users = 0;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** `#rrggbb` to sRGB 0..1, alpha 1: the shader writes colours as they are. */
function hexToRgb(hex: string): Rgba {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return [((value >> 16) & 0xff) / 255, ((value >> 8) & 0xff) / 255, (value & 0xff) / 255, 1];
}

/**
 * The colours of the current theme, from the page's custom properties (the
 * stylesheet keeps these four as six-digit hex in both themes).
 */
function readPalette(): Palette {
  const root = document.documentElement;
  const style = getComputedStyle(root);
  const color = (name: string, fallback: string) => {
    const value = style.getPropertyValue(name).trim();
    return hexToRgb(/^#[0-9a-f]{6}$/i.test(value) ? value : fallback);
  };
  return {
    dark: root.classList.contains("dark"),
    colorA: color("--side-a", DEFAULT_COLORS.a),
    colorB: color("--side-b", DEFAULT_COLORS.b),
    background: color("--background", DEFAULT_COLORS.background),
    foreground: color("--foreground", DEFAULT_COLORS.foreground),
  };
}

function paletteParams(palette: Palette) {
  return {
    dark: palette.dark ? 1 : 0,
    color_a: palette.colorA,
    color_b: palette.colorB,
    background: palette.background,
    foreground: palette.foreground,
  };
}

/** Triangle wave: continuous time that never exceeds `period`. */
function pingPong(seconds: number, period: number): number {
  const phase = seconds % (2 * period);
  return phase < period ? phase : 2 * period - phase;
}

/** Cell side in device pixels: whole pixels for the field, so its lines stay crisp. */
function cellSize(view: View): number {
  const { layout } = view.options;
  if (layout.kind === "field") return Math.max(4, Math.round(layout.cell * view.surface.dpr));
  return Math.max(1, view.surface.size[1] / layout.rows);
}

function modeOf(layout: CubesLayout): number {
  if (layout.kind === "field") return 0;
  return layout.neutral ? 2 : 1;
}

async function createShared(): Promise<Shared> {
  const gpu = await init();
  const views = new Set<View>();
  const time = clock(gpu);

  // Where the pointer is, in client pixels; the field lights the cells under it.
  const pointer = { x: 0, y: 0, inside: false };
  const onMove = (event: PointerEvent) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.inside = true;
  };
  const onLeave = () => {
    pointer.inside = false;
  };
  // The last click, in client pixels: the field sends a ring out from it.
  const click = { x: 0, y: 0, at: Number.NEGATIVE_INFINITY };
  const onDown = (event: PointerEvent) => {
    click.x = event.clientX;
    click.y = event.clientY;
    click.at = performance.now();
  };
  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerdown", onDown, { passive: true });
  document.documentElement.addEventListener("pointerleave", onLeave);

  // The theme is a class on <html>; when it flips, every canvas takes the new colours.
  const theme = { palette: readPalette() };
  const themeObserver = new MutationObserver(() => {
    theme.palette = readPalette();
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });

  const loop = frameLoop(gpu, (frame) => {
    if (document.hidden) return;
    // A tab coming back from the background reports one huge delta.
    const dt = Math.min(0.1, Math.max(0, time.deltaTime));
    // Frame-rate independent version of "5% of the way each frame".
    const ease = 1 - Math.pow(1 - EASE_PER_FRAME, dt * 60);
    const pointerEase = 1 - Math.pow(1 - POINTER_EASE_PER_FRAME, dt * 60);
    const seconds = pingPong(time.time, TIME_PERIOD);
    const clickAge = Math.min(NO_CLICK_SECONDS, (performance.now() - click.at) / 1000);

    for (const view of views) {
      // A canvas inside a hidden panel has no box to draw into.
      if (view.options.canvas.clientWidth === 0 || view.options.canvas.clientHeight === 0) continue;
      const target = view.options.getState();
      if (target.pulse !== view.seenPulse) {
        view.seenPulse = target.pulse;
        view.impact = target.pulseDir;
      }
      if (target.glitch !== view.seenGlitch) {
        view.seenGlitch = target.glitch;
        view.glitch = 1;
      }
      view.share += (clamp01(target.share) - view.share) * ease;
      view.provisional += ((target.provisional ? 1 : 0) - view.provisional) * ease;
      view.intensity += (clamp01(target.intensity) - view.intensity) * ease;
      view.impact = Math.sign(view.impact) * Math.max(0, Math.abs(view.impact) - dt / IMPACT_SECONDS);
      view.glitch = Math.max(0, view.glitch - dt / GLITCH_SECONDS);

      // Only the field follows the pointer and the clicks; x < 0 tells the
      // shader there is no pointer.
      const isField = view.options.layout.kind === "field";
      const rect = isField ? view.options.canvas.getBoundingClientRect() : null;
      const toUv = (x: number, y: number): [number, number] =>
        rect ? [(x - rect.left) / Math.max(1, rect.width), (y - rect.top) / Math.max(1, rect.height)] : [-1, -1];
      if (rect && pointer.inside) {
        const [x, y] = toUv(pointer.x, pointer.y);
        if (view.pointer[0] < 0) view.pointer = [x, y];
        view.pointer[0] += (x - view.pointer[0]) * pointerEase;
        view.pointer[1] += (y - view.pointer[1]) * pointerEase;
      } else {
        view.pointer = [-1, -1];
      }

      if (view.seenPalette !== theme.palette) {
        view.seenPalette = theme.palette;
        view.fx.set({ params: paletteParams(theme.palette) });
      }

      view.fx.set({
        params: {
          time: seconds,
          share: view.share,
          impact: view.impact,
          glitch: view.glitch,
          tension: 1 - Math.abs(view.share - 0.5) * 2,
          provisional: view.provisional,
          intensity: view.intensity,
          texel: view.surface.texelSize,
          pointer: view.pointer,
          cell: cellSize(view),
          line: Math.max(1, Math.round(view.surface.dpr)),
          click_age: isField ? clickAge : NO_CLICK_SECONDS,
          click: toUv(click.x, click.y),
        },
      });
      frame.pass(view.surface, view.fx);
    }
  });

  return {
    gpu,
    loop,
    views,
    get palette() {
      return theme.palette;
    },
    stopListening: () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      themeObserver.disconnect();
    },
  };
}

/** Lets go of the shared device; the last canvas to leave stops the loop and frees the GPU. */
function release(mine: Promise<Shared>) {
  users -= 1;
  if (users > 0 || shared !== mine) return;
  shared = null;
  mine
    .then((instance) => {
      instance.loop.stop();
      instance.stopListening();
      instance.gpu.dispose();
    })
    .catch(() => {
      // The device never came up; there is nothing to free.
    });
}

/**
 * Draws cubes on `canvas` with the shared device (vgpu, one fullscreen
 * effect per canvas, no compute). Returns the function that removes the
 * canvas again.
 */
export function mountCubes(options: CubesOptions): () => void {
  let disposed = false;
  let view: View | undefined;

  users += 1;
  shared ??= createShared();
  const mine = shared;

  mine
    .then(async (instance) => {
      if (disposed) return;
      const first = options.getState();
      const canvasSurface = surface(instance.gpu, options.canvas, { dpr: [1, 2] });
      const fx = effect(instance.gpu, cubesShader, {
        label: `cubes-${options.layout.kind}`,
        set: {
          params: {
            time: 0,
            share: clamp01(first.share),
            impact: 0,
            glitch: 0,
            tension: 1 - Math.abs(clamp01(first.share) - 0.5) * 2,
            provisional: first.provisional ? 1 : 0,
            intensity: clamp01(first.intensity),
            mode: modeOf(options.layout),
            texel: canvasSurface.texelSize,
            pointer: [-1, -1],
            cell: 32,
            line: 1,
            click_age: NO_CLICK_SECONDS,
            click: [-1, -1],
            _pad1: [0, 0],
            ...paletteParams(instance.palette),
          },
        },
      });
      // Surfaces only exist inside a frame; precompile against the surface's format.
      await fx.compile({ colors: [canvasSurface.format] });
      if (disposed) return canvasSurface.dispose();

      view = {
        options,
        surface: canvasSurface,
        fx,
        share: clamp01(first.share),
        provisional: first.provisional ? 1 : 0,
        intensity: clamp01(first.intensity),
        impact: 0,
        glitch: 0,
        // Counters seen so far: whatever they hold on mount is history, not a pulse.
        seenPulse: first.pulse,
        seenGlitch: first.glitch,
        seenPalette: instance.palette,
        pointer: [-1, -1],
      };
      instance.views.add(view);
    })
    .catch((error) => {
      if (!disposed) options.onError?.(error);
    });

  return () => {
    disposed = true;
    if (view) {
      const mounted = view;
      void mine.then((instance) => instance.views.delete(mounted)).catch(() => {});
      mounted.surface.dispose();
    }
    release(mine);
  };
}
