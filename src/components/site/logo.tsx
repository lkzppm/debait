import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

/** The wordmark: "debait" with the AI in the middle picked out in the two side colours. */
export function Logo({ className, label }: { className?: string; label: string }) {
  const [head, ai, tail] = BRAND.wordmark;
  return (
    <Link href="/" aria-label={label} className={cn("font-semibold tracking-tight select-none", className)}>
      {head}
      <span className="wordmark-ai">{ai}</span>
      {tail}
    </Link>
  );
}
