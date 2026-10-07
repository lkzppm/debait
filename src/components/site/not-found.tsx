"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useT } from "@/i18n/LocaleProvider";
import { Nav } from "./nav";
import { Pill } from "./pill";

export function NotFound() {
  const t = useT();
  return (
    <>
      <Nav />
      <main className="flex min-h-[calc(100dvh-3.5rem)] flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-4xl font-medium tracking-tight">{t.notFound.title}</h1>
      <p className="text-muted-foreground">{t.notFound.body}</p>
      <Pill asChild variant="outline" className="mt-2">
        <Link href="/">
          <ArrowLeft />
          {t.notFound.back}
        </Link>
      </Pill>
      </main>
    </>
  );
}
