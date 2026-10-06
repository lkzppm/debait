import { clock, effect, frameLoop, init, surface } from "vgpu";
import type { FrameLoopHandle } from "vgpu";
import { SIDE_COLORS } from "@/lib/brand";
import arenaShader from "./arena.wgsl";

/** What the arena should be showing; read every frame, eased toward here. */
export interface ArenaState {
  /** Share of side A, 0..1. */
  share: number;
  /** Counter: a change fires an impact pulse in the direction of `pulseDir`. */
  pulse: number;
  pulseDir: 1 | -1;
  /** Counter: a change fires a glitch pulse. */
  glitch: number;
  provisional: boolean;
  /** Ink strength, 0..1. */
  intensity: number;
}

export interface ArenaOptions {
  canvas: HTMLCanvasElement;
  getState: () => ArenaState;
  onError?: (error: unknown) => void;
}

/** Fraction of the remaining distance covered per frame at 60 fps. */
const EASE_PER_FRAME = 0.05;
/** Seconds an impact pulse takes to fade. */
const IMPACT_SECONDS = 1.1;
/** Seconds a glitch pulse takes to fade. */
const GLITCH_SECONDS = 0.7;
/**
 * The noise loses precision when its time axis grows without bound, so the
 * shader's clock runs forward and back over this many seconds instead.
 */
const TIME_PERIOD = 1800;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** `#rrggbb` to linear rgb (gamma 2.2), alpha 1: the shader mixes in linear light. */
function hexToLinear(hex: string): [number, number, number, number] {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  const channel = (shift: number) => Math.pow(((value >> shift) & 0xff) / 255, 2.2);
  return [channel(16), channel(8), channel(0), 1];
}

/** Triangle wave: continuous time that never exceeds `period`. */
function pingPong(seconds: number, period: number): number {
  const phase = seconds % (2 * period);
  return phase < period ? phase : 2 * period - phase;
}

/**
 * The "arena" background: one fullscreen effect (vgpu), no compute. Returns
 * the function that stops the loop and releases the GPU.
 */
export function startArena(options: ArenaOptions): () => void {
  let disposed = false;
  let loop: FrameLoopHandle | undefined;
  let gpu: Awaited<ReturnType<typeof init>> | undefined;

  void (async () => {
    try {
      gpu = await init();
      if (disposed) return gpu.dispose();

      const first = options.getState();
      let share = clamp01(first.share);
      let provisional = first.provisional ? 1 : 0;
      let intensity = clamp01(first.intensity);
      let impact = 0;
      let glitch = 0;
      // Counters seen so far: whatever they hold on mount is history, not a pulse.
      let seenPulse = first.pulse;
      let seenGlitch = first.glitch;

      const canvasSurface = surface(gpu, options.canvas, { dpr: [1, 2] });
      const fx = effect(gpu, arenaShader, {
        label: "arena",
        set: {
          params: {
            time: 0,
            share,
            impact,
            glitch,
            tension: 1 - Math.abs(share - 0.5) * 2,
            provisional,
            intensity,
            _pad0: 0,
            texel: canvasSurface.texelSize,
            _pad1: [0, 0],
            color_a: hexToLinear(SIDE_COLORS.a),
            color_b: hexToLinear(SIDE_COLORS.b),
          },
        },
      });
      canvasSurface.onResize(() => fx.set({ params: { texel: canvasSurface.texelSize } }));
      // Surfaces only exist inside a frame; precompile against the surface's format.
      await fx.compile({ colors: [canvasSurface.format] });
      if (disposed) return;

      const time = clock(gpu);
      loop = frameLoop(gpu, (frame) => {
        if (document.hidden) return;
        // A tab coming back from the background reports one huge delta.
        const dt = Math.min(0.1, Math.max(0, time.deltaTime));
        const target = options.getState();

        if (target.pulse !== seenPulse) {
          seenPulse = target.pulse;
          impact = target.pulseDir;
        }
        if (target.glitch !== seenGlitch) {
          seenGlitch = target.glitch;
          glitch = 1;
        }

        // Frame-rate independent version of "5% of the way each frame".
        const ease = 1 - Math.pow(1 - EASE_PER_FRAME, dt * 60);
        share += (clamp01(target.share) - share) * ease;
        provisional += ((target.provisional ? 1 : 0) - provisional) * ease;
        intensity += (clamp01(target.intensity) - intensity) * ease;
        impact = Math.sign(impact) * Math.max(0, Math.abs(impact) - dt / IMPACT_SECONDS);
        glitch = Math.max(0, glitch - dt / GLITCH_SECONDS);

        fx.set({
          params: {
            time: pingPong(time.time, TIME_PERIOD),
            share,
            impact,
            glitch,
            tension: 1 - Math.abs(share - 0.5) * 2,
            provisional,
            intensity,
          },
        });
        frame.pass(canvasSurface, fx);
      });
    } catch (error) {
      if (!disposed) options.onError?.(error);
    }
  })();

  return () => {
    disposed = true;
    loop?.stop();
    gpu?.dispose();
  };
}
