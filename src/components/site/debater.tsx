import { cn } from "@/lib/utils";

// A debater, eight cells wide, drawn like Deb: head, neck and shoulders.
const BODY = ["..####..", ".######.", ".#.##.#.", ".######.", "..####..", "...##...", ".######.", "########"];
const SIZE = 8;

/** A person's avatar next to their bubble; it takes the text colour around it (a side's colour). */
export function Debater({ className, title }: { className?: string; title?: string }) {
  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className={cn("size-5 shrink-0", className)} shapeRendering="crispEdges" aria-hidden={!title} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      {BODY.flatMap((row, y) =>
        [...row].map((cell, x) => (cell === "." ? null : <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="currentColor" />)),
      )}
    </svg>
  );
}
