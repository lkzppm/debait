import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

const VARIANTS = {
  /** The one loud button on a screen: solid purple. */
  primary: "bg-side-a text-ink hover:bg-side-a-deep",
  green: "bg-side-b text-ink hover:bg-side-b-deep",
  outline: "border border-input text-foreground hover:bg-accent",
  ghost: "text-muted-foreground hover:bg-accent hover:text-foreground",
  danger: "border border-destructive/50 text-destructive hover:bg-destructive/15",
} as const;

const SIZES = {
  sm: "h-8 gap-1.5 px-3 text-xs",
  md: "h-10 gap-2 px-5 text-sm",
  lg: "h-12 gap-2 px-7 text-base",
  icon: "size-10",
} as const;

interface PillProps extends React.ComponentProps<"button"> {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  asChild?: boolean;
}

/** The app's button: fully rounded, flat, purple when it is the main action. */
export function Pill({ variant = "primary", size = "md", asChild, className, ...props }: PillProps) {
  const Component = asChild ? Slot.Root : "button";
  return (
    <Component
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:pointer-events-none disabled:opacity-40 [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}

/** A small rounded label: "✓ CONFIRMED", "MOCK". */
export function Tag({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-input px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em] whitespace-nowrap uppercase",
        className,
      )}
      {...props}
    />
  );
}
