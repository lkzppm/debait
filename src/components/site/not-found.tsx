"use client";

import Link from "next/link";
import { useT } from "@/i18n/LocaleProvider";
import { Logo } from "./logo";

export function NotFound() {
  const t = useT();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <Logo label={t.common.home} className="text-2xl" />
      <h1 className="mt-4 text-xl font-semibold">{t.notFound.title}</h1>
      <p className="text-sm text-muted-foreground">{t.notFound.body}</p>
      <Link href="/" className="mt-2 text-sm underline underline-offset-4">
        {t.notFound.back}
      </Link>
    </main>
  );
}
