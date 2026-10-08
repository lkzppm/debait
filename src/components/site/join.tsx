"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { CubesBand } from "@/components/cubes/cubes-canvas";
import { useT } from "@/i18n/LocaleProvider";
import { cn } from "@/lib/utils";
import { ActionButton } from "./action-button";
import { Deb } from "./deb";

const LENGTH = 6;
const ROOM_CODE = /^[a-z]{6}$/;

/**
 * The page that enters a room by its code: six cells, three in each side's
 * colour, filled as you type. One real input sits invisibly over them, so
 * focus, paste and the phone keyboard all work as on any text field.
 */
export function Join() {
  const t = useT();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [focused, setFocused] = useState(false);
  const [invalid, setInvalid] = useState(false);

  const enter = (event: React.FormEvent) => {
    event.preventDefault();
    const id = code.toLowerCase();
    if (!ROOM_CODE.test(id)) {
      setInvalid(true);
      inputRef.current?.focus();
      return;
    }
    router.push(`/r/${id}`);
  };

  const complete = code.length === LENGTH;

  return (
    <main className="mx-auto grid min-h-[calc(100dvh-var(--nav-h))] w-full max-w-6xl content-center gap-8 px-4 py-8 sm:gap-12 sm:px-6 sm:py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
      <header className="flex flex-col gap-4">
        <Deb mood="busy" sides className="size-10" />
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{t.join.title}</h1>
        <p className="max-w-md text-base text-muted-foreground sm:text-lg">{t.join.lead}</p>
      </header>

      <form onSubmit={enter} noValidate className="relative overflow-hidden border border-border bg-card">
        <div className="relative h-3">
          <CubesBand share={0.5} rows={1} intensity={0.8} />
        </div>
        <div className="flex flex-col gap-5 p-4 sm:gap-6 sm:p-8">
          <label htmlFor="room-code" className="eyebrow text-muted-foreground">
            {t.join.codeLabel}
          </label>

          {/* The six cells, and the input laid over them. */}
          <div className="relative">
            <div className="grid grid-cols-6 gap-2 sm:gap-3" aria-hidden>
              {Array.from({ length: LENGTH }, (_, index) => {
                const letter = code[index];
                const sideA = index < LENGTH / 2;
                const next = focused && index === code.length;
                return (
                  <div
                    key={index}
                    className={cn(
                      "grid aspect-square place-items-center border-2 font-mono text-2xl font-medium uppercase transition-[background-color,border-color,scale] duration-200 sm:text-4xl",
                      sideA ? "border-side-a/40" : "border-side-b/40",
                      letter && (sideA ? "scale-105 border-side-a bg-side-a text-ink" : "scale-105 border-side-b bg-side-b text-ink"),
                      next && (sideA ? "border-side-a" : "border-side-b"),
                      invalid && !letter && "border-destructive/60",
                    )}
                  >
                    {letter ?? (next && <span className="caret" />)}
                  </div>
                );
              })}
            </div>
            <input
              ref={inputRef}
              id="room-code"
              value={code}
              onChange={(event) => {
                setCode(event.target.value.replace(/[^a-zA-Z]/g, "").slice(0, LENGTH));
                setInvalid(false);
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              aria-label={t.join.codeLabel}
              aria-invalid={invalid}
              autoComplete="one-time-code"
              autoCapitalize="characters"
              autoFocus
              spellCheck={false}
              maxLength={LENGTH}
              // 16px: iOS Safari zooms into a smaller field when it takes focus, invisible or not.
              className="absolute inset-0 cursor-text text-base opacity-0"
            />
          </div>

          <p className={cn("text-sm", invalid ? "text-destructive" : "text-muted-foreground")}>{invalid ? t.join.invalid : t.join.hint}</p>

          {/* Centred, and glowing once the six letters are in. */}
          <ActionButton ready={complete} className="w-full sm:w-auto sm:self-center">
            {t.join.enter}
          </ActionButton>
        </div>
      </form>
    </main>
  );
}
