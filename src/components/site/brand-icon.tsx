import type { SimpleIcon } from "simple-icons";
import { cn } from "@/lib/utils";

/** A brand glyph from simple-icons, drawn in the current text colour. */
export function BrandIcon({ icon, className }: { icon: Pick<SimpleIcon, "title" | "path">; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={cn("size-4 shrink-0", className)} aria-hidden>
      <path d={icon.path} />
    </svg>
  );
}
