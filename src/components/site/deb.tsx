import { cn } from "@/lib/utils";

// Deb, eight cells wide: a small pixel referee with a bow in her hair, two
// loops and a knot. "#" is a lit cell, "b" is the bow's pink (the bow where it
// covers the head, or a blush).
const FACES = {
  idle: ["...bb.bb", ".##bbbbb", "#.#bb.bb", "#.###.#.", "#######.", "##...##.", "#######.", ".#...#.."],
  // Eyes up and to the side: looking something up.
  busy: ["...bb.bb", ".##bbbbb", "#.#bb.bb", "#######.", "#######.", "###.###.", "#######.", ".#...#.."],
  // Brows down: she saw that.
  stern: ["...bb.bb", ".##bbbbb", "#..bb.bb", "#.###.#.", "#######.", "#.....#.", "#######.", ".#...#.."],
  // The three verdicts on a message: a grin, the flat idle mouth, a frown with brows.
  // The grin is wide on top and narrow below, the chin closes under it, and the
  // cheeks blush in the bow's pink: a smile has to read at 16px.
  good: ["...bb.bb", ".##bbbbb", "###bb#bb", "#.###.#.", "b#####b.", "#.....#.", "##...##.", ".#####.."],
  bad: ["...bb.bb", ".##bbbbb", "#..bb.bb", "#.###.#.", "#######.", "##...##.", "#.###.#.", ".#...#.."],
} as const;

/** Points thresholds for Deb's face next to a score. */
export function verdictMood(points: number): "good" | "idle" | "bad" {
  return points >= 65 ? "good" : points >= 40 ? "idle" : "bad";
}
const SIZE = 8;
/** The head's middle column. */
const MIDDLE = 3;

interface DebProps {
  mood?: keyof typeof FACES;
  className?: string;
  title?: string;
  /** Purple on her left, aqua on her right, as on the landing page; otherwise the text colour. */
  sides?: boolean;
}

/** The bot's avatar. In one colour it inherits the text colour around it; the bow is always pink. */
export function Deb({ mood = "idle", className, sides = false, title }: DebProps) {
  const fillOf = (cell: string, x: number) => {
    if (cell === "b") return "var(--bow)";
    if (!sides) return "currentColor";
    if (x === MIDDLE) return "color-mix(in srgb, var(--side-a), var(--side-b))";
    return x < MIDDLE ? "var(--side-a)" : "var(--side-b)";
  };
  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className={cn("size-5 shrink-0", className)} shapeRendering="crispEdges" aria-hidden={!title} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      {FACES[mood].flatMap((row, y) =>
        [...row].map((cell, x) =>
          cell === "." ? null : <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={fillOf(cell, x)} />,
        ),
      )}
    </svg>
  );
}
