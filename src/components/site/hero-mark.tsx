"use client";

import { TriangleAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { FallacyId } from "@/i18n/fallacies";
import { useT } from "@/i18n/LocaleProvider";
import { FALLACY_UNIT } from "@/lib/debate/scoring";
import { cn } from "@/lib/utils";

/* Deb, drawn live: the referee as a face of cubes, purple on side A's half
   and green on side B's, with the middle column changing hands. The cells
   build in on load and reshuffle their shade while idle; her eyes follow
   the pointer, she blinks, and a poke makes her frown and raise a flag. */

// "#" body, "o" eye socket, "m" mouth row, "b" the bow, "." nothing.
const BODY = [
  ".....bb.bb.",
  "..###bbbbb.",
  ".####bb#bb.",
  "###########",
  "##oo###oo##",
  "##oo###oo##",
  "###########",
  "###mmmmm###",
  "###########",
  ".#########.",
  "..##...##..",
] as const;
const COLUMNS = BODY[0].length;
const MIDDLE = (COLUMNS - 1) / 2;
/** Left edge of each socket; both are two cells wide and sit on rows 4 and 5. */
const SOCKETS = [2, 7] as const;
const EYE_ROW = 4;

/** Mouth columns left open, per mood. */
const MOUTH = { idle: [4, 5, 6], stern: [3, 4, 5, 6, 7] } as const;
type Mood = keyof typeof MOUTH;

/** How much of the side colour a cell shows over the page: the mosaic's four shades. */
const SHADES = [58, 72, 86, 100];
/** Milliseconds between two reshuffles. */
const TICK = 900;
const BLINK_EVERY = 3600;
const BLINK_FOR = 150;
const STERN_FOR = 1500;

/** What a poke raises, in turn: a fallacy and its severity. */
const FLAGS: [FallacyId, number][] = [
  ["ad_hominem", 2],
  ["straw_man", 2],
  ["false_dilemma", 1],
  ["whataboutism", 1],
];

/** A stable pseudo-random number in 0..1, so server and browser draw the same face. */
function noise(x: number, y: number, salt: number): number {
  let value = (Math.imul(x + 1, 0x9e3779b1) ^ Math.imul(y + 1, 0x85ebca6b) ^ Math.imul(salt + 1, 0xc2b2ae35)) | 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

type Gaze = readonly [0 | 1, 0 | 1];

/** Whether the cell at (x, y) is lit, and whether it is a pupil. */
function cellOf(x: number, y: number, mood: Mood, blink: boolean, gaze: Gaze): "off" | "body" | "pupil" | "bow" {
  const kind = BODY[y][x];
  if (kind === ".") return "off";
  if (kind === "#") return "body";
  if (kind === "b") return "bow";
  if (kind === "m") return (MOUTH[mood] as readonly number[]).includes(x) ? "off" : "body";
  // An eye socket: a lid or a brow closes its top row; the pupil sits in one of its cells.
  const left = x < MIDDLE;
  const socket = left ? SOCKETS[0] : SOCKETS[1];
  const top = y === EYE_ROW;
  if (blink) return top ? "body" : "off";
  if (mood === "stern") {
    if (top) return "body";
    // Pupils pulled toward the nose.
    return x === (left ? socket + 1 : socket) ? "pupil" : "off";
  }
  return x === socket + gaze[0] && y === EYE_ROW + gaze[1] ? "pupil" : "off";
}

export function HeroMark({ className }: { className?: string }) {
  const t = useT();
  const ref = useRef<HTMLButtonElement>(null);
  const [tick, setTick] = useState(0);
  const [blink, setBlink] = useState(false);
  const [gaze, setGaze] = useState<Gaze>([1, 0]);
  // Each poke gets a number; the flag it raised leaves when its time is up.
  const [poke, setPoke] = useState<{ id: number; live: boolean }>({ id: 0, live: false });

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const shuffle = setInterval(() => setTick((value) => value + 1), TICK);
    let lid: ReturnType<typeof setTimeout>;
    const blinking = setInterval(() => {
      setBlink(true);
      lid = setTimeout(() => setBlink(false), BLINK_FOR);
    }, BLINK_EVERY);
    return () => {
      clearInterval(shuffle);
      clearInterval(blinking);
      clearTimeout(lid);
    };
  }, []);

  // The eyes look at the quadrant the pointer is in.
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;
      const x: 0 | 1 = event.clientX > rect.left + rect.width / 2 ? 1 : 0;
      // Up or down is measured from the line between the two eye rows.
      const eyeLine = rect.top + (rect.height * (EYE_ROW + 1)) / BODY.length;
      const y: 0 | 1 = event.clientY > eyeLine ? 1 : 0;
      setGaze((current) => (current[0] === x && current[1] === y ? current : [x, y]));
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useEffect(() => {
    if (!poke.live) return;
    const id = setTimeout(() => setPoke((current) => ({ ...current, live: false })), STERN_FOR);
    return () => clearTimeout(id);
  }, [poke]);

  const mood: Mood = poke.live ? "stern" : "idle";
  const [fallacy, severity] = FLAGS[poke.id % FLAGS.length];

  return (
    <button
      ref={ref}
      type="button"
      aria-label={t.home.poke}
      onClick={() => setPoke((current) => ({ id: current.id + 1, live: true }))}
      className={cn("hero-mark relative block cursor-pointer outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/60", className)}
    >
      <span
        aria-hidden
        className="grid gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${COLUMNS}, var(--mark-cell))`, gridAutoRows: "var(--mark-cell)" }}
      >
        {BODY.flatMap((row, y) =>
          [...row].map((_, x) => {
            const state = cellOf(x, y, mood, blink && !poke.live, gaze);
            // The middle column changes hands; the rest belongs to its half.
            const contested = x === MIDDLE;
            const era = Math.floor((tick + Math.floor(noise(x, y, 3) * 4)) / 4);
            const sideA = contested ? noise(x, y, era + 11) < 0.5 : x < MIDDLE;
            const shade = SHADES[Math.floor(noise(x, y, era) * SHADES.length)];
            const style: CSSProperties & { "--delay": string } = {
              "--delay": `${Math.round(Math.hypot(x - MIDDLE, y - 5.5) * 45)}ms`,
              backgroundColor:
                state === "pupil"
                  ? "var(--foreground)"
                  : state === "bow"
                    ? "var(--bow)"
                    : state === "body"
                    ? `color-mix(in srgb, var(${sideA ? "--side-a" : "--side-b"}) ${shade}%, var(${sideA ? "--side-a-shade" : "--side-b-shade"}))`
                    : "transparent",
            };
            return <span key={`${x}-${y}`} className="hero-mark-cell" data-state={state} style={style} />;
          }),
        )}
      </span>

      <AnimatePresence>
        {poke.live && (
          <motion.span
            key={poke.id}
            initial={{ opacity: 0, y: 16, scale: 0.8, rotate: 0 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotate: poke.id % 2 ? -4 : 3 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: "spring", stiffness: 420, damping: 22 }}
            className="absolute -top-6 left-1/2 flex -translate-x-1/2 items-center gap-2 border border-destructive/50 bg-background px-3 py-1.5 text-sm whitespace-nowrap text-destructive shadow-lg"
          >
            <TriangleAlert className="size-4 shrink-0" />
            {t.fallacies[fallacy].name} −{FALLACY_UNIT * severity}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
