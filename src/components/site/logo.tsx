import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { Deb } from "./deb";

/** The wordmark: Deb, then "debait" with the a in purple and the i in aqua. `short` keeps only Deb on phones. */
export function Logo({ className, label, short = false }: { className?: string; label: string; short?: boolean }) {
  const [head, ai, tail] = BRAND.wordmark;
  return (
    <Link href="/" aria-label={label} className={cn("inline-flex items-center gap-2 font-medium tracking-tight select-none", className)}>
      <Deb sides className="size-[1.1em]" />
      <span className={cn(short && "hidden sm:inline")}>
        {head}
        <span className="text-side-a">{ai[0]}</span>
        <span className="text-side-b">{ai[1]}</span>
        {tail}
      </span>
    </Link>
  );
}
