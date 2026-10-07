"use client";

import { LogIn, Plus, Shield } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { siGithub } from "simple-icons";
import { useT } from "@/i18n/LocaleProvider";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { BrandIcon } from "./brand-icon";
import { LocaleSwitch } from "./locale-switch";
import { Logo } from "./logo";
import { ThemeSwitch } from "./theme-switch";

const ICON = "grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";

/**
 * The top bar, shared by the pages outside a room: the wordmark as the home
 * link on the left, the two doors (enter, create) in the middle, and the
 * source, the admin panel, the language and the theme on the right. The
 * current page's door is underlined in purple, and the underline slides
 * when the page changes: the bar lives in the (site) layout, so it stays
 * mounted across navigations. On a phone the doors take a second row as
 * two equal tabs (`--nav-h` in globals.css follows the bar's height).
 */
export function Nav() {
  const t = useT();
  const pathname = usePathname();
  const doors = [
    { href: "/join", label: t.home.join, icon: LogIn },
    { href: "/create", label: t.home.create, icon: Plus },
  ];
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 sm:bg-background/85 sm:backdrop-blur">
      <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto] items-center gap-x-4 px-4 sm:h-14 sm:grid-cols-[1fr_auto_1fr] sm:px-6">
        <Logo label={t.common.home} className="h-14 text-xl" />

        <nav
          className="col-span-2 row-start-2 -mx-4 grid grid-cols-2 border-t border-border sm:order-2 sm:col-span-1 sm:row-auto sm:mx-0 sm:flex sm:items-center sm:gap-1 sm:border-0"
          aria-label={t.common.pages}
        >
          {doors.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-12 items-center justify-center gap-2 px-3 text-sm transition-colors hover:text-foreground sm:h-14 sm:justify-start",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <Icon className="size-4" />
                {label}
                {active && (
                  <motion.span
                    layoutId="nav-door"
                    className="absolute inset-x-3 bottom-0 h-0.5 bg-side-a"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                    aria-hidden
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="col-start-2 row-start-1 flex h-14 items-center justify-end gap-1 sm:order-3 sm:col-auto sm:row-auto sm:gap-2">
          <a href={BRAND.repo} target="_blank" rel="noreferrer noopener" className={ICON} title={t.common.source} aria-label={t.common.source}>
            <BrandIcon icon={siGithub} />
          </a>
          <Link
            href="/admin"
            className={cn(ICON, pathname.startsWith("/admin") && "bg-accent text-foreground")}
            title={t.home.admin}
            aria-label={t.home.admin}
            aria-current={pathname.startsWith("/admin") ? "page" : undefined}
          >
            <Shield className="size-4" />
          </Link>
          <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden />
          <LocaleSwitch />
          <ThemeSwitch />
        </div>
      </div>
    </header>
  );
}
