"use client";

import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { Deb } from "./deb";

interface ActionButtonProps {
  children: React.ReactNode;
  /** The form is filled in: the button glows and Deb smiles. */
  ready: boolean;
  /** The request is on its way: Deb looks busy and the button waits. */
  busy?: boolean;
  className?: string;
}

/**
 * A page's one big submit: blue into red like the meter, with Deb on it. It
 * glows once the form is ready, grows and catches a sweeping shine on hover,
 * and stays dim until then.
 */
export function ActionButton({ children, ready, busy = false, className }: ActionButtonProps) {
  const live = ready && !busy;
  return (
    <motion.button
      type="submit"
      disabled={!live}
      whileHover={live ? { scale: 1.04 } : undefined}
      whileTap={live ? { scale: 0.97 } : undefined}
      className={cn(
        "group relative isolate inline-flex h-14 items-center justify-center gap-3 px-8 text-base font-semibold text-ink outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-40 sm:h-16 sm:px-10 sm:text-lg",
        className,
      )}
    >
      {live && (
        <motion.span
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.35, 0.7, 0.35] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -inset-1.5 -z-20 bg-linear-to-r from-side-a to-side-b blur-lg"
        />
      )}
      <span aria-hidden className="absolute inset-0 -z-10 overflow-hidden bg-linear-to-r from-side-a to-side-b">
        {/* A shine that sweeps across on hover. It waits well past the left edge, since the skew
            pushes its top corner forward, and stays invisible until the hover starts it; leaving snaps it back unseen. */}
        <span className="absolute inset-y-0 left-0 w-1/3 -translate-x-[180%] -skew-x-12 bg-white/35 opacity-0 transition-[translate,opacity] duration-0 ease-out group-hover:translate-x-[350%] group-hover:opacity-100 group-hover:duration-700" />
      </span>
      <Deb mood={busy ? "busy" : ready ? "good" : "idle"} className="size-6 text-ink sm:size-7" />
      {children}
      <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
    </motion.button>
  );
}
