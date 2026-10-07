"use client";

import { Lock } from "lucide-react";
import { CreateForm } from "@/components/admin/create-form";
import { Login } from "@/components/admin/login";
import { useT } from "@/i18n/LocaleProvider";

/** The page that creates a debate: the admin password first, then the form, centred on the screen. */
export function Create({ authed, devHint }: { authed: boolean; devHint: boolean }) {
  const t = useT();
  return (
    <main className="mx-auto flex min-h-[calc(100dvh-var(--nav-h))] w-full max-w-6xl flex-col items-center justify-center gap-6 px-4 py-8 sm:px-6 sm:py-12">
      {authed ? (
        <CreateForm />
      ) : (
        <>
          <Login devHint={devHint} />
          <p className="flex max-w-sm items-start gap-2 text-sm text-muted-foreground">
            <Lock className="mt-0.5 size-4 shrink-0" />
            {t.create.locked}
          </p>
        </>
      )}
    </main>
  );
}
