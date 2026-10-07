import { pcg3d, unitFloat } from "@vgpu/wgsl-std/hash";
import { saturate } from "@vgpu/wgsl-std/math";
import { simplex3d } from "@vgpu/wgsl-std/noise/simplex";

// "Cubes": the debate drawn on a pixel grid. Side A owns the cells left of
// the frontier, side B the cells to its right. Two modes share the cell logic:
//   mode 0 (field): the page's background with a thin grid. Cells rise out of
//                   it as small extruded cubes, in drifting clusters; the two
//                   colours capture each other's cells along the frontier; a
//                   dithered glow of each side fills the empty ground.
//   mode 1 (band):  a dense mosaic, every cell lit in a shade of its side.
//   mode 2 (band):  the same mosaic in neutral greys, ignoring the share.
// Everything is composited over the theme's background colour, so the same
// shader serves the dark and the light page. Colours are sRGB and written as
// they are (the surface format is not sRGB), so a tint here matches the same
// colour at the same alpha in CSS.
struct Params {
  time: f32,         // seconds, kept bounded by the TS side
  share: f32,        // eased share of side A, 0..1
  impact: f32,       // signed pulse, 1 -> 0 (side A gained) or -1 -> 0 (side B gained)
  glitch: f32,       // pulse, 1 -> 0
  tension: f32,      // 0 = one-sided, 1 = dead even
  provisional: f32,  // 0..1, the round is incomplete
  intensity: f32,    // overall strength, 0..1
  mode: f32,         // 0 field, 1 band, 2 neutral band
  texel: vec2f,      // 1 / resolution (device pixels)
  pointer: vec2f,    // eased pointer in uv, x < 0 when there is none
  cell: f32,         // cell side in device pixels
  line: f32,         // grid line width in device pixels
  dark: f32,         // 1 on the dark theme, 0 on the light one
  click_age: f32,    // seconds since the last click, large when there was none
  click: vec2f,      // where the last click landed, in uv
  _pad1: vec2f,
  color_a: vec4f,    // sRGB
  color_b: vec4f,    // sRGB
  background: vec4f, // sRGB, the page behind the cells
  foreground: vec4f, // sRGB, the text colour: grid lines and neutral greys
}
@group(0) @binding(0) var<uniform> params: Params;

const WHITE: vec3f = vec3f(1.0);
const FLAG_RED: vec3f = vec3f(1.0, 0.36, 0.36);

// One random number per cell and per integer `salt`.
fn cell_hash(id: vec2f, salt: f32) -> f32 {
  return unitFloat(pcg3d(vec3u(u32(id.x), u32(id.y), u32(salt + 4096.0))).x);
}

// Holds a per-cell random value for a while, then crosses to the next one in
// the last part of each period: cells change one by one, never all at once.
fn held(id: vec2f, phase: f32, seed: f32) -> f32 {
  let k = floor(phase);
  let from_value = cell_hash(id, k + seed);
  let to_value = cell_hash(id, k + 1.0 + seed);
  return mix(from_value, to_value, smoothstep(0.82, 1.0, fract(phase)));
}

// 0..1 into four flat steps, with a short ramp between steps so a cell climbs
// to its next level instead of popping.
fn steps4(value: f32) -> f32 {
  let scaled = clamp(value, 0.0, 0.999) * 4.0;
  return (floor(scaled) + smoothstep(0.75, 1.0, fract(scaled))) / 4.0;
}

// The 4 x 4 ordered-dither matrix, as a threshold in 0..1.
fn bayer4(at: vec2u) -> f32 {
  let x = at.x & 3u;
  let y = at.y & 3u;
  let xy = x ^ y;
  let rank = ((xy & 1u) << 3u) | ((y & 1u) << 2u) | (xy & 2u) | ((y & 2u) >> 1u);
  return (f32(rank) + 0.5) / 16.0;
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let t = params.time;
  let is_field = params.mode < 0.5;
  let bg = params.background.rgb;
  let fg = params.foreground.rgb;
  let px = uv / params.texel;
  var cols = 1.0 / (params.texel.x * params.cell);
  var grid = px / params.cell;
  if (!is_field) {
    // A band shows a whole number of columns: cells stretch by a few percent
    // rather than leave a sliver at the edge.
    cols = max(1.0, round(cols));
    grid.x = uv.x * cols;
  }
  let id = floor(grid);
  let local = fract(grid) * params.cell;   // device pixels inside the cell
  let h = cell_hash(id, 0.0);
  let hit = abs(params.impact);

  // The frontier, in cells. The field's is jagged: each row sits a few cells
  // off the share and drifts slowly, further when the debate is close. The
  // band's is straight, so the mosaic reads as an exact meter.
  var front = params.share * cols;
  if (is_field) {
    let wander = simplex3d(vec3f(id.y * 0.37, t * 0.06, 9.1));
    front += wander * mix(1.2, 3.6, params.tension);
  }
  let front_col = floor(front);
  let on_front_col = id.x == front_col;
  // Signed distance from the cell's centre to the frontier, in cells:
  // positive on side A's ground.
  let reach_a = front - (id.x + 0.5);
  // Distance from the frontier in whole cells: 0 for the cells that touch it.
  let depth = select(id.x - front_col, front_col - 1.0 - id.x, (id.x < front_col));

  // Who owns the cell. In the band the frontier column belongs to side A in
  // proportion to how far the share reaches into it, cell by cell, re-drawn a
  // few times a second. In the field the cells around the frontier are
  // contested: every turn each one is drawn again, the likelier for a side
  // the deeper it sits in that side's ground, and a cell that changes hands
  // flashes as the turn begins.
  var is_a = (id.x < front_col);
  var capture = 0.0;
  if (is_field) {
    let odds_a = saturate(0.5 + reach_a / mix(1.2, 3.0, params.tension));
    let phase = t * mix(0.12, 0.3, params.tension) + h * 7.0;
    let turn = floor(phase);
    let before = (cell_hash(id, turn + 52.0) < odds_a);
    is_a = (cell_hash(id, turn + 53.0) < odds_a);
    capture = select(0.0, 1.0 - smoothstep(0.0, 0.12, fract(phase)), is_a != before);
  } else if (on_front_col) {
    is_a = (held(id, t * mix(1.6, 4.0, params.provisional) + h * 3.0, 31.0) < fract(front));
  }
  let side = select(params.color_b.rgb, params.color_a.rgb, is_a);

  // Impact: a ragged wave in the winner's colour leaves the frontier and
  // crosses into the side that lost.
  let a_gained = params.impact > 0.0;
  // Comparisons are parenthesised wherever a `<` is followed by a `>` on the
  // same line: the validator would read the pair as a template list.
  let in_loser = select((id.x < front_col), (id.x >= front_col), a_gained);
  let reach = select(cols * 0.5, 16.0, is_field);
  let wave_at = (1.0 - hit) * reach;
  let in_wave = in_loser && (abs(depth - wave_at) < 1.6) && (h > 0.22);
  let wave = select(0.0, hit, in_wave && hit > 0.0);
  let winner = select(params.color_b.rgb, params.color_a.rgb, a_gained);

  // Glitch: scattered cells flash in the text colour or red, a new set every
  // few frames.
  let flick = cell_hash(id, floor(t * 14.0) + 97.0);
  let flash = select(0.0, params.glitch, (flick > select(0.86, 0.94, is_field)));
  let flash_col = select(fg, FLAG_RED, h > 0.5);

  var col = bg;

  if (is_field) {
    let near = exp(-abs(reach_a) / 2.6);

    // Clusters: low-frequency noise sampled once per cell, so neighbours rise
    // together, drift, and sink over seconds. Sparse far from the frontier,
    // crowded next to it.
    let cluster = simplex3d(vec3f(id * 0.23, t * 0.045)) + (h - 0.5) * 0.22;
    let threshold = mix(0.6, -0.1, near);
    var height = steps4((cluster - threshold) / 0.5);

    // The cells that touch the frontier always stand; while the round is
    // provisional they bob up and down instead of standing firm.
    if (abs(reach_a) < 1.0) {
      let blink = 0.3 + 0.7 * step(0.5, fract(t * 0.7 + h));
      height = max(height, mix(0.5, 0.5 * blink, params.provisional));
    }

    // The pointer wakes the cells under it and sends rings outwards; a click
    // sends one wider ring. Both are measured in cells, so they travel as
    // steps of cubes popping up, not as a smooth circle.
    let centre = id + 0.5;
    let from_pointer = distance(centre, params.pointer / params.texel / params.cell);
    let beat = fract(t * 0.45);
    let ring = (1.0 - beat) * (1.0 - smoothstep(0.0, 0.9, abs(from_pointer - beat * 8.0)));
    let wake = 1.0 - smoothstep(0.5, 2.5, from_pointer);
    let hover = select(0.0, max(ring * 0.45, wake * 0.6), params.pointer.x >= 0.0);
    let from_click = distance(centre, params.click / params.texel / params.cell);
    let fade = saturate(1.0 - params.click_age / 1.8);
    let splash = fade * (1.0 - smoothstep(0.0, 1.3, abs(from_click - params.click_age * 12.0)));
    let stirred = max(hover, splash);
    height = max(max(height, stirred), max(wave, capture));

    // A slow diagonal sweep of light across whatever stands in its way.
    let sweep_at = fract((id.x + id.y) * 0.03 - t * 0.06);
    let sweep = 1.0 - smoothstep(0.0, 0.07, abs(sweep_at - 0.5));

    // Far from the frontier a cube is barely above the page; next to it,
    // plainly its side's colour.
    var alpha = (0.35 + 0.65 * height) * mix(0.1, 0.36, near) + 0.1 * sweep + 0.3 * stirred;
    alpha = max(saturate(alpha), max(wave * 0.8, capture * 0.7)) * params.intensity;
    // A tint this faint washes out on either page: the cubes press harder on
    // paper, and somewhat harder on the night page too, or they all but vanish.
    alpha = saturate(alpha * mix(1.7, 1.45, params.dark));
    // A capture flashes towards white on the dark page; on the light page the
    // full colour is already the brightest thing there is.
    var tint = mix(side, WHITE, 0.6 * capture * params.dark);
    tint = mix(tint, winner, wave);

    // The dithered glow on the ground: each cell is cut in 4 x 4 dots, and a
    // dot is on when the glow there beats its place in the Bayer matrix.
    let speck = floor(local / (params.cell * 0.25));
    let speck_reach = front - (id.x + (speck.x + 0.5) * 0.25);
    let glow_side = select(params.color_b.rgb, params.color_a.rgb, speck_reach > 0.0);
    let glow = (0.45 * exp(-abs(speck_reach) / 4.0) + 0.1 * (cluster + 0.6)) * params.intensity;
    let speck_on = glow > bayer4(vec2u(id) * 4u + vec2u(speck));
    col = mix(bg, glow_side, select(0.0, 0.1, speck_on));

    // The cube: a square face lifted up and to the left by its height, with
    // the two walls it shows drawn below and to the right (an oblique view).
    if (height > 0.0) {
      let pad = max(1.0, floor(params.cell * 0.07));
      let rise = params.cell * (0.05 + 0.14 * height);
      let face_min = vec2f(params.line + pad);
      let face_max = vec2f(params.cell - pad - rise);
      let inside = local - face_min;
      let beyond = local - face_max;
      let in_face = (min(inside.x, inside.y) >= 0.0) && (max(beyond.x, beyond.y) < 0.0);
      let on_right = (beyond.x >= 0.0) && (beyond.x < rise) && (inside.y >= beyond.x) && (beyond.y < beyond.x);
      let on_bottom = (beyond.y >= 0.0) && (beyond.y < rise) && (inside.x >= beyond.y) && (beyond.x <= beyond.y);
      if (in_face) {
        // A bevel: the top and left edges catch the light.
        let on_edge = min(inside.x, inside.y) < params.line;
        col = mix(bg, mix(tint, WHITE, select(0.0, 0.18, on_edge)), alpha);
      } else if (on_right) {
        col = mix(bg, tint * 0.5, alpha);
      } else if (on_bottom) {
        col = mix(bg, tint * 0.7, alpha);
      }
    }

    col = mix(col, flash_col, flash * 0.55 * params.intensity);

    // The grid itself: a hairline on the left and top edge of each cell.
    let on_line = local.x < params.line || local.y < params.line;
    col = mix(col, fg, select(0.0, mix(0.12, 0.14, params.dark), on_line));
  } else {
    // Mosaic: four flat shades between the page and the full colour, each
    // cell reshuffling on its own clock.
    let shade = 0.42 + 0.58 * (floor(held(id, t * 0.22 + h * 9.0, 7.0) * 3.999) / 3.0);
    let neutral = params.mode > 1.5;
    col = mix(bg, side, shade);
    if (neutral) {
      col = mix(bg, fg, mix(0.08, 0.34, (shade - 0.42) / 0.58));
    } else {
      // While provisional the frontier column fades, so it reads as undecided.
      col = mix(col, bg, select(0.0, 0.38 * params.provisional, on_front_col));
      col = mix(col, mix(winner, WHITE, 0.55), wave * 0.8);
    }
    // A light bevel: each cell is a low tile, lit from the top left.
    let far_edge = vec2f(params.cell) - local;
    let lit_edge = min(local.x, local.y) < params.line;
    let dim_edge = min(far_edge.x, far_edge.y) < params.line;
    col = mix(col, WHITE, select(0.0, 0.1, lit_edge));
    col = mix(col, vec3f(0.0), select(0.0, 0.1, dim_edge && !lit_edge));
    col = mix(col, flash_col, flash * 0.7);
    col = mix(bg, col, mix(0.35, 1.0, params.intensity));
  }

  return vec4f(col, 1.0);
}
