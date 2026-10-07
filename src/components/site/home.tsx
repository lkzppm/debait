"use client";

import { ChevronDown } from "lucide-react";
import { motion } from "motion/react";
import { CubesField } from "@/components/cubes/cubes-canvas";
import { FALLACY_IDS } from "@/i18n/fallacies";
import { useT } from "@/i18n/LocaleProvider";
import { BRAND } from "@/lib/brand";
import { QUALITY_KEYS } from "@/lib/debate/types";
import { cn } from "@/lib/utils";
import { Demo } from "./demo";
import { HeroMark } from "./hero-mark";

const STACK = [
  { label: "Groq", href: "https://groq.com" },
  { label: "Next.js", href: "https://nextjs.org" },
  { label: "WebGPU · vgpu", href: "https://vgpu.sh" },
  { label: "Vercel", href: "https://vercel.com" },
];

const EASE = [0.22, 1, 0.36, 1] as const;

/** Rises its children into place the first time they scroll into view. */
function Reveal({ delay = 0, className, children }: { delay?: number; className?: string; children: React.ReactNode }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -15% 0px" }}
      transition={{ duration: 0.7, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/**
 * The landing page. One viewport with the live mark, the name, one sentence
 * and the field to enter a room; under it, a debate played step by step.
 */
export function Home() {
  const t = useT();
  const [head, ai, tail] = BRAND.wordmark;

  const facts = [
    { value: FALLACY_IDS.length, ...t.home.facts.fallacies, tone: "text-side-a" },
    { value: QUALITY_KEYS.length, ...t.home.facts.criteria, tone: "text-side-b" },
    { value: 0, ...t.home.facts.model, tone: "text-foreground" },
  ];

  return (
    <div className="relative min-h-dvh overflow-x-hidden">
      <CubesField className="fixed" share={0.5} intensity={0.45} />


      <main className="relative z-10">
        {/* One viewport: the live mark on the left, the name and the brief on the right, the arrow down. */}
        <section className="relative mx-auto grid min-h-[calc(100dvh-3.5rem)] max-w-6xl place-items-center px-4 pt-12 pb-28 sm:px-6">
          <div className="grid items-center justify-items-center gap-12 lg:grid-cols-[auto_minmax(0,1fr)] lg:justify-items-start lg:gap-20">
            <HeroMark />

            {/* The page colour, feathered, keeps the words readable over the cubes. */}
            <div className="relative flex max-w-xl flex-col items-center gap-5 text-center lg:items-start lg:text-left">
              <div
                aria-hidden
                className="absolute -inset-x-28 -inset-y-24 -z-10 bg-[radial-gradient(ellipse_at_center,var(--background)_45%,transparent_72%)]"
              />
              <h1 className="hero-rise text-7xl leading-none font-semibold tracking-tight sm:text-8xl">
                {head}
                <span className="text-side-a">{ai[0]}</span>
                <span className="text-side-b">{ai[1]}</span>
                {tail}
              </h1>
              <p className="hero-rise text-lg leading-relaxed text-foreground/85 [--delay:80ms]">{t.home.brief}</p>


              <ul className="hero-rise mt-4 flex w-full flex-wrap justify-center gap-x-5 gap-y-1 border-t border-border pt-4 [--delay:160ms] lg:justify-start">
                {STACK.map((item) => (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-2 py-1 font-mono text-xs text-muted-foreground transition-[color,translate] hover:-translate-y-0.5 hover:text-side-a"
                    >
                      <span className="size-1.5 bg-current" />
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <a
            href="#how"
            className="hero-rise absolute inset-x-0 bottom-6 mx-auto flex w-fit flex-col items-center gap-1 text-muted-foreground transition-colors [--delay:900ms] hover:text-side-a"
          >
            <span className="eyebrow">{t.home.discover}</span>
            <ChevronDown className="hero-bounce size-5" />
          </a>
        </section>

        {/* How it works: one debate, shown the ways the room shows it. */}
        <section id="how" className="scroll-mt-20 border-y border-border bg-background">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <Reveal>
              <h2 className="eyebrow mb-10 text-side-a">{t.home.demo.title}</h2>
              <Demo />
            </Reveal>

            <dl className="mt-16 grid gap-8 border-t border-border pt-8 sm:grid-cols-3">
              {facts.map((fact, index) => (
                <Reveal key={fact.label} delay={0.1 + index * 0.08} className="group flex flex-col gap-1.5">
                  <dd className={cn("font-mono text-5xl leading-none tracking-tighter transition-[translate] duration-300 group-hover:-translate-y-0.5", fact.tone)}>
                    {fact.value}
                  </dd>
                  <dt className="eyebrow">{fact.label}</dt>
                  <dd className="text-sm text-muted-foreground">{fact.hint}</dd>
                </Reveal>
              ))}
            </dl>
          </div>
        </section>

        <footer className="mx-auto max-w-6xl px-4 py-8 text-sm text-muted-foreground sm:px-6">
          <span className="bg-background px-1">{t.home.footer}</span>
        </footer>
      </main>
    </div>
  );
}
