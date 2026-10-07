"use client";

import { KeyRound, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Deb } from "@/components/site/deb";
import { Pill } from "@/components/site/pill";
import { useT } from "@/i18n/LocaleProvider";
import { api, type ClientError } from "@/lib/api";

/** The text field of the admin forms: a square box that lights up purple when focused. */
export const FIELD =
  "h-11 w-full border border-input bg-background px-3.5 text-base outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/60 focus-visible:border-side-a focus-visible:ring-2 focus-visible:ring-side-a/30 aria-invalid:border-destructive";

/** The admin password form; on success the page re-renders with the cookie set. */
export function Login({ devHint }: { devHint: boolean }) {
  const t = useT();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ClientError | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await api("/api/admin/login", { body: { password } });
    setBusy(false);
    if (result.ok) router.refresh();
    else setError(result.error);
  };

  return (
    <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-5 border border-t-2 border-border border-t-side-a bg-card p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <Deb mood={error ? "stern" : "idle"} sides className="size-8" />
        <KeyRound className="size-4 text-muted-foreground" />
      </div>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="eyebrow text-muted-foreground">{t.admin.password}</span>
        <input
          type="password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setError(null);
          }}
          autoComplete="current-password"
          autoFocus
          aria-invalid={error === "unauthorized"}
          className={FIELD}
        />
      </label>
      <Pill type="submit" disabled={busy || !password}>
        <LogIn />
        {t.admin.signIn}
      </Pill>
      {error && <p className="text-sm text-destructive">{t.errors[error]}</p>}
      {devHint && <p className="text-xs text-warning">{t.admin.devHint}</p>}
    </form>
  );
}
