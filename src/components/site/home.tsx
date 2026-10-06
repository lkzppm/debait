"use client";

import { ArrowRight, AtSign, Scale, Sigma } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArenaCanvas } from "@/components/arena/arena-canvas";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/LocaleProvider";
import { BRAND } from "@/lib/brand";
import { LocaleSwitch } from "./locale-switch";
import { Logo } from "./logo";

const ICONS = [Sigma, AtSign, Scale];
const ROOM_CODE = /^[a-z]{6}$/;

/** The landing page: what this is, and a field to enter a room by its code. */
export function Home() {
  const t = useT();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [head, ai, tail] = BRAND.wordmark;

  const enter = (event: React.FormEvent) => {
    event.preventDefault();
    const id = code.trim().toLowerCase();
    if (!ROOM_CODE.test(id)) return setInvalid(true);
    router.push(`/r/${id}`);
  };

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <ArenaCanvas className="fixed" share={0.5} intensity={0.9} />

      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between p-4 sm:p-6">
        <Logo label={t.common.home} className="text-xl" />
        <div className="flex items-center gap-3">
          <a
            href={BRAND.repo}
            target="_blank"
            rel="noreferrer noopener"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            GitHub
          </a>
          <LocaleSwitch />
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-10 px-4 py-8 sm:px-6">
        <section className="max-w-2xl">
          <p className="text-6xl font-semibold tracking-tighter sm:text-8xl">
            {head}
            <span className="wordmark-ai">{ai}</span>
            {tail}
          </p>
          <h1 className="mt-5 text-2xl font-medium tracking-tight sm:text-3xl">{t.home.tagline}</h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground sm:text-lg">{t.home.lead}</p>

          <form onSubmit={enter} className="mt-7 flex max-w-sm flex-col gap-2" noValidate>
            <label htmlFor="room-code" className="text-xs tracking-wider text-muted-foreground uppercase">
              {t.home.codeLabel}
            </label>
            <div className="flex gap-2">
              <input
                id="room-code"
                value={code}
                onChange={(event) => {
                  setCode(event.target.value.replace(/[^a-zA-Z]/g, "").slice(0, 6));
                  setInvalid(false);
                }}
                placeholder={t.home.codePlaceholder}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                aria-invalid={invalid}
                className="panel h-12 min-w-0 flex-1 rounded-xl px-4 font-mono text-xl tracking-[0.3em] uppercase outline-none placeholder:text-sm placeholder:tracking-normal placeholder:normal-case focus-visible:ring-2 focus-visible:ring-ring/50"
              />
              <Button type="submit" className="h-12 px-4" aria-label={t.home.enter}>
                <span className="hidden sm:inline">{t.home.enter}</span>
                <ArrowRight />
              </Button>
            </div>
            {invalid && <p className="text-sm text-destructive">{t.home.invalid}</p>}
          </form>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          {t.home.features.map((feature, index) => {
            const Icon = ICONS[index % ICONS.length];
            return (
              <article key={feature.title} className="panel rounded-2xl p-4">
                <Icon className="size-5 text-bot" />
                <h2 className="mt-3 font-medium">{feature.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
              </article>
            );
          })}
        </section>
      </main>

      <footer className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between p-4 text-xs text-muted-foreground sm:p-6">
        <span>{t.home.footer}</span>
        <Link href="/admin" className="underline-offset-4 hover:text-foreground hover:underline">
          {t.home.admin}
        </Link>
      </footer>
    </div>
  );
}
