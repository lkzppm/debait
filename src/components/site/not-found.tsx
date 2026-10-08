"use client";

import { ArrowLeft, LogIn } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { CubesBand } from "@/components/cubes/cubes-canvas";
import { useT } from "@/i18n/LocaleProvider";
import { Deb } from "./deb";
import { Nav } from "./nav";
import { Pill } from "./pill";

/**
 * No room at this address: Deb looks left and right for it, a question mark
 * bobbing over her bow, in a card topped by the two sides' band like the join
 * page. The way out is another code, or the start.
 */
export function NotFound() {
  const t = useT();
  return (
    <>
      <Nav />
      <main className="grid min-h-[calc(100dvh-var(--nav-h))] place-items-center px-4 py-10">
        <section className="w-full max-w-lg overflow-hidden border border-border bg-card text-center">
          <div className="relative h-3">
            <CubesBand share={0.5} rows={1} intensity={0.8} />
          </div>

          <div className="flex flex-col items-center gap-4 px-6 py-10 sm:px-10 sm:py-12">
            <div className="relative mb-2">
              {/* She turns to one side, then the other, looking for the room. */}
              <motion.div
                animate={{ scaleX: [1, 1, -1, -1, 1] }}
                transition={{ duration: 4, times: [0, 0.4, 0.45, 0.9, 0.95], repeat: Infinity, ease: "linear" }}
              >
                <Deb mood="busy" className="size-20 text-bot sm:size-24" />
              </motion.div>
              <motion.span
                aria-hidden
                animate={{ y: [0, -6, 0], rotate: [-8, 8, -8] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-5 -right-6 font-mono text-4xl font-semibold text-[var(--bow)]"
              >
                ?
              </motion.span>
            </div>

            <p className="eyebrow text-muted-foreground">404 · {t.notFound.eyebrow}</p>
            <h1 className="text-4xl font-medium tracking-tight sm:text-5xl">{t.notFound.title}</h1>
            <p className="max-w-sm text-muted-foreground">{t.notFound.body}</p>

            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Pill asChild>
                <Link href="/join">
                  <LogIn />
                  {t.notFound.tryCode}
                </Link>
              </Pill>
              <Pill asChild variant="outline">
                <Link href="/">
                  <ArrowLeft />
                  {t.notFound.back}
                </Link>
              </Pill>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
