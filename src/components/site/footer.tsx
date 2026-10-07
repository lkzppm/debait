"use client";

import Link from "next/link";
import { siGithub } from "simple-icons";
import { useT } from "@/i18n/LocaleProvider";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { BrandIcon } from "./brand-icon";
import { Logo } from "./logo";

// simple-icons dropped LinkedIn's mark at the company's request; this is the same glyph, on the same 24x24 grid.
const LINKEDIN = {
  title: "LinkedIn",
  path: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
};

const LINK = "w-fit transition-[color,translate] duration-200 hover:translate-x-0.5 hover:text-side-a";

/**
 * A column hanging from the rail by a pixel cell: side A's colour for the
 * first half of the footer, side B's for the second, like the meter. The
 * cell lights up while the column is hovered. Below `sm` the columns wrap
 * two by two and only the first row keeps its cell.
 */
function Column({ seat, heading, children }: { seat: "a" | "b"; heading: string; children: React.ReactNode }) {
  return (
    <div className="group relative flex flex-col gap-2 text-sm text-muted-foreground [&:nth-child(n+3)>i]:hidden sm:[&:nth-child(n+3)>i]:block">
      <i
        aria-hidden
        className={cn(
          "absolute -top-[29px] left-0 size-3 border-[1.5px] bg-background transition-[background-color,border-color,scale] duration-300 group-hover:scale-125",
          seat === "a" ? "border-side-a group-hover:bg-side-a" : "border-side-b group-hover:bg-side-b",
        )}
      />
      <h3 className="eyebrow mb-1.5 text-foreground">{heading}</h3>
      {children}
    </div>
  );
}

/** The foot of the landing page, laid out like GraphMan's: four columns on a rail, then the wordmark and the year. */
export function Footer() {
  const t = useT();
  const f = t.home.footer;
  const { author } = BRAND;
  return (
    <footer className="relative border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-4 pt-14 pb-9 sm:px-6">
        {/* The rail: a hairline across the top that the columns hang from. */}
        <div className="relative grid grid-cols-2 gap-x-6 gap-y-9 pt-6 before:absolute before:inset-x-0 before:top-0 before:h-[1.5px] before:bg-border sm:grid-cols-4 sm:gap-8">
          <Column seat="a" heading={f.project}>
            <a href={BRAND.repo} target="_blank" rel="noreferrer noopener" className={LINK}>
              {f.source}
            </a>
            <Link href="/join" className={LINK}>
              {t.home.join}
            </Link>
            <Link href="/create" className={LINK}>
              {t.home.create}
            </Link>
            <Link href="/admin" className={LINK}>
              {t.home.admin}
            </Link>
          </Column>

          <Column seat="a" heading={f.stack}>
            <span>Groq · gpt-oss</span>
            <span>Next.js · vgpu (WebGPU)</span>
            <span>Vercel · Upstash Redis</span>
            <span>{f.licence}</span>
          </Column>

          <Column seat="b" heading={f.author}>
            <span className="text-foreground">{author.name}</span>
            <a href={author.github} target="_blank" rel="noreferrer noopener" className={cn(LINK, "inline-flex items-center gap-2")}>
              <BrandIcon icon={siGithub} className="size-[15px]" />
              {f.github}
            </a>
            <a href={author.linkedin} target="_blank" rel="noreferrer noopener" className={cn(LINK, "inline-flex items-center gap-2")}>
              <BrandIcon icon={LINKEDIN} className="size-[15px]" />
              {f.linkedin}
            </a>
          </Column>

          <Column seat="b" heading={f.course}>
            <span>{f.courseName}</span>
            <span>UFRJ · 2026/2</span>
          </Column>
        </div>

        {/* The wordmark and the year, centred. */}
        <div className="mt-11 flex items-center justify-center gap-3.5 border-t border-border pt-6">
          <Logo label={t.common.home} className="text-xl transition-colors hover:text-side-a" />
          <span className="font-mono text-xs text-muted-foreground">{f.copyright}</span>
        </div>
      </div>
    </footer>
  );
}
