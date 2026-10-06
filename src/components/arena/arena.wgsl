import { fbmSimplex3d, simplex3d } from "@vgpu/wgsl-std/noise/simplex";

// "Arena": the debate as a tug of war. Two domain-warped noise fields, one
// per side, drift toward a frontier that sits at x = share and is displaced
// by noise. Side A owns the left, side B the right. A thin bright seam marks
// where they touch; the side that just gained surges and sends a ring into
// the other; a flag makes the picture tear for a moment.
//
// Shading is done in linear light and encoded at the end (the surface format
// is not sRGB), so the two colours add up cleanly where they overlap.
struct Params {
  time: f32,         // seconds, kept bounded by the TS side
  share: f32,        // eased share of side A, 0..1
  impact: f32,       // signed pulse, 1 -> 0 (side A gained) or -1 -> 0 (side B gained)
  glitch: f32,       // pulse, 1 -> 0
  tension: f32,      // 0 = one-sided, 1 = dead even
  provisional: f32,  // 0..1, the round is incomplete
  intensity: f32,    // ink strength, 0..1
  _pad0: f32,
  texel: vec2f,      // 1 / resolution
  _pad1: vec2f,
  color_a: vec4f,    // linear rgb
  color_b: vec4f,    // linear rgb
}
@group(0) @binding(0) var<uniform> params: Params;

const BASE: vec3f = vec3f(0.0033, 0.0033, 0.0052); // #0B0B10 in linear light

fn remap01(value: f32, low: f32, high: f32) -> f32 {
  return clamp((value - low) / (high - low), 0.0, 1.0);
}

// One side's ink: an fBM field whose domain is warped by two cheaper samples
// and which drifts along `flow` (toward the frontier), so each side reads as
// a mass leaning on the other.
fn side_field(p: vec2f, t: f32, flow: f32, seed: f32) -> f32 {
  let q = vec2f(p.x - flow * t * 0.045, p.y);
  let warp = vec2f(
    simplex3d(vec3f(q * 1.3, t * 0.05 + seed)),
    simplex3d(vec3f(q * 1.3 + vec2f(5.2, 1.3), t * 0.05 + seed + 2.8)),
  );
  let n = fbmSimplex3d(vec3f(q * 2.1 + warp * 0.75, t * 0.07 + seed), 3, 2.17, 0.5);
  return remap01(n, -0.55, 0.6);
}

// Cheap per-pixel noise to break up banding in the dark gradients.
fn dither(uv: vec2f) -> f32 {
  return fract(sin(dot(uv / params.texel, vec2f(12.9898, 78.233))) * 43758.5453) - 0.5;
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let aspect = params.texel.y / params.texel.x;
  let t = params.time;
  let hit = abs(params.impact);
  let g = params.glitch;

  // Glitch, part 1: horizontal bands slide sideways, a different amount each
  // few frames, and only some of them.
  let band = floor(uv.y * 26.0);
  let tear = simplex3d(vec3f(band * 1.7, floor(t * 18.0) * 0.61, 3.1));
  var guv = uv;
  guv.x += tear * step(0.3, abs(tear)) * 0.045 * g;

  let p = vec2f(guv.x * aspect, guv.y);

  // The frontier: x = share, pushed around by a slow swell and a faster
  // ripple. An even debate (high tension) makes it more turbulent.
  let swell = fbmSimplex3d(vec3f(guv.y * 1.6, t * 0.11, 7.3), 2, 2.17, 0.5);
  let ripple = simplex3d(vec3f(guv.y * 5.5, t * 0.32, 1.9));
  let reach = mix(0.03, 0.075, params.tension);
  var frontier = params.share + swell * reach + ripple * reach * 0.28;
  // The side that gained shoves the line into the other for a moment.
  frontier += params.impact * hit * 0.05 * (0.65 + 0.35 * ripple);

  // Signed distance to the frontier in aspect-corrected units: negative on
  // side A (left), positive on side B (right).
  let d = (guv.x - frontier) * aspect;

  // Glitch, part 2: the two ends of the spectrum disagree about where the
  // frontier is, which reads as chromatic aberration without any texture.
  let soft = mix(0.014, 0.085, params.provisional);
  let split = g * 0.03;
  let mask = vec3f(
    smoothstep(-soft, soft, d + split),
    smoothstep(-soft, soft, d),
    smoothstep(-soft, soft, d - split),
  );

  let field_a = side_field(p, t, 1.0, 0.0);
  let field_b = side_field(p, t, -1.0, 11.0);

  // Each side glows hardest where it presses on the other and thins out
  // toward its own edge of the screen.
  let press = exp(-abs(d) * 2.4);
  let body = 0.22 + 0.78 * press;
  let surge_a = 1.0 + max(params.impact, 0.0) * 1.1;
  let surge_b = 1.0 + max(-params.impact, 0.0) * 1.1;
  let ink_a = field_a * body * surge_a;
  let ink_b = field_b * body * surge_b;

  var col = params.color_a.rgb * ink_a * (vec3f(1.0) - mask) + params.color_b.rgb * ink_b * mask;

  // Shock ring: leaves the frontier and travels into the side that lost.
  let loser = select(1.0 - mask.g, mask.g, params.impact > 0.0);
  let ring_at = (1.0 - hit) * 0.55;
  let ring = exp(-pow((abs(d) - ring_at) * 11.0, 2.0)) * hit * loser;
  let winner_col = select(params.color_b.rgb, params.color_a.rgb, params.impact > 0.0);
  col += winner_col * ring * 0.55;

  // The seam: a thin bright core and a wider halo, dimmer and wider while
  // the round is provisional.
  let core_w = mix(0.0035, 0.016, params.provisional);
  let core = exp(-pow(d / core_w, 2.0));
  let halo = exp(-pow(d / (core_w * 7.0), 2.0));
  let seam_col = mix(params.color_a.rgb, params.color_b.rgb, 0.5) * 0.5 + vec3f(0.55);
  let seam_gain = mix(1.0, 0.4, params.provisional) * (0.55 + 0.45 * params.tension + hit * 0.9);
  col += seam_col * (core * 0.9 + halo * 0.16) * seam_gain;

  // Glitch, part 3: scanlines and a brief lift in brightness.
  let scan = step(0.5, fract(uv.y / (params.texel.y * 4.0)));
  col *= 1.0 - 0.3 * g * scan;
  col += vec3f(0.02) * g;

  // Keep the corners quiet so panels and text stay readable.
  let vig = smoothstep(0.95, 0.2, length(uv - vec2f(0.5)));
  col *= mix(0.45, 1.0, vig) * params.intensity;

  let lit = BASE + col;
  let encoded = pow(clamp(lit, vec3f(0.0), vec3f(1.0)), vec3f(1.0 / 2.2));
  return vec4f(encoded + vec3f(dither(uv) / 255.0), 1.0);
}
