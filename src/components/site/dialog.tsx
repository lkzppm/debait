"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Dialog as Radix } from "radix-ui";
import { useT } from "@/i18n/LocaleProvider";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Read to screen readers; the visible heading is the caller's business. */
  title: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * The app's popup: a square card over a dimmed page, closed by the X, the
 * backdrop or Escape. On a phone it is a sheet rising from the bottom edge.
 * Radix handles focus and the portal; motion handles the fade and the
 * slight lift, with the exit animation kept by keeping the Radix tree
 * mounted until it ends. No blur on phones: it would sit over the cubes.
 */
export function Dialog({ open, onOpenChange, title, children, className }: DialogProps) {
  const t = useT();
  return (
    <Radix.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Radix.Portal forceMount>
            <Radix.Overlay asChild forceMount>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-40 bg-background/75 sm:backdrop-blur-sm"
              />
            </Radix.Overlay>
            <Radix.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                transition={{ type: "spring", stiffness: 320, damping: 30 }}
                className={cn(
                  "fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] w-full flex-col border border-border bg-card shadow-2xl shadow-black/30 outline-none",
                  "sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[min(90dvh,56rem)] sm:w-[calc(100vw-2rem)] sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2",
                  className,
                )}
              >
                <Radix.Title className="sr-only">{title}</Radix.Title>
                <Radix.Close
                  aria-label={t.common.close}
                  className="absolute top-3 right-3 z-10 grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <X className="size-4" />
                </Radix.Close>
                <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none">{children}</div>
              </motion.div>
            </Radix.Content>
          </Radix.Portal>
        )}
      </AnimatePresence>
    </Radix.Root>
  );
}
