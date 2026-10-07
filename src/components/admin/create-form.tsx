"use client";

import { ExternalLink, Minus, Plus, Square } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useState } from "react";
import { CubesBand } from "@/components/cubes/cubes-canvas";
import { CopyButton } from "@/components/site/copy-button";
import { Deb } from "@/components/site/deb";
import { Pill } from "@/components/site/pill";
import { PillSwitch } from "@/components/site/pill-switch";
import { useLocale } from "@/i18n/LocaleProvider";
import { LOCALES, DICTIONARIES, type Locale } from "@/i18n";
import { api, type ClientError } from "@/lib/api";
import { DEFAULT_STRICTNESS } from "@/lib/debate/scoring";
import { STRICTNESS_LEVELS, type Strictness } from "@/lib/debate/types";
import type { RoomSummary } from "@/lib/rooms";
import { useOrigin } from "@/lib/use-origin";
import { cn } from "@/lib/utils";
import { FIELD } from "./login";

/** The room this browser created and has not closed yet. */
const STORAGE_KEY = "debait.created";

function readCreated(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeCreated(id: string | null) {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Not persisted; the room still shows until the page is left.
  }
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block text-sm", className)}>
      <span className="eyebrow text-muted-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

/** A number chosen with two buttons, so phones never show a spinner. */
function Stepper({ value, min, max, step = 1, onChange }: { value: number; min: number; max: number; step?: number; onChange: (value: number) => void }) {
  const set = (next: number) => onChange(Math.min(max, Math.max(min, next)));
  const button = "grid w-11 place-items-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30";
  return (
    <div className="flex h-11 items-stretch border border-input bg-background">
      <button type="button" onClick={() => set(value - step)} disabled={value <= min} className={button} aria-label="−">
        <Minus className="size-4" />
      </button>
      <output className="grid flex-1 place-items-center border-x border-input font-mono text-lg tabular-nums">{value}</output>
      <button type="button" onClick={() => set(value + step)} disabled={value >= max} className={button} aria-label="+">
        <Plus className="size-4" />
      </button>
    </div>
  );
}

/**
 * One room at a time: the form creates a debate (needs the admin cookie),
 * then the room's card takes its place, with the code, the QR code and the
 * link, until the room is closed. The card survives a reload: the room id
 * is kept in this browser and looked up again.
 */
export function CreateForm({ onCreated }: { onCreated?: () => void }) {
  const { t, locale } = useLocale();
  const origin = useOrigin();
  const [motion, setMotion] = useState("");
  // Empty means "use the default in the chosen language".
  const [stanceA, setStanceA] = useState("");
  const [stanceB, setStanceB] = useState("");
  const [botLocale, setBotLocale] = useState<Locale | null>(null);
  const [rounds, setRounds] = useState(3);
  const [challenges, setChallenges] = useState(3);
  const [charLimit, setCharLimit] = useState(600);
  const [strictness, setStrictness] = useState<Strictness>(DEFAULT_STRICTNESS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ClientError | null>(null);
  // Null while the stored room is being looked up, so the form does not flash first.
  const [room, setRoom] = useState<RoomSummary | null | undefined>(undefined);

  const roomLocale = botLocale ?? locale;
  const defaults = DICTIONARIES[roomLocale].admin;

  /** Finds the room this browser created, if it still exists and is not over. */
  const lookUp = useCallback(async (id: string | null) => {
    if (!id) return setRoom(null);
    const result = await api<{ rooms: RoomSummary[] }>("/api/admin/rooms");
    const found = result.ok ? result.data.rooms.find((candidate) => candidate.id === id) : undefined;
    if (!found || found.status === "finished") {
      writeCreated(null);
      setRoom(null);
    } else {
      setRoom(found);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => lookUp(readCreated()), 0);
    return () => clearTimeout(timer);
  }, [lookUp]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await api<{ id: string }>("/api/admin/rooms", {
      body: {
        motion,
        stanceA: stanceA.trim() || defaults.defaultStanceA,
        stanceB: stanceB.trim() || defaults.defaultStanceB,
        locale: roomLocale,
        rounds,
        challenges,
        charLimit,
        strictness,
      },
    });
    setBusy(false);
    if (result.ok) {
      writeCreated(result.data.id);
      setMotion("");
      await lookUp(result.data.id);
      onCreated?.();
    } else {
      setError(result.error);
    }
  };

  const close = async () => {
    if (!room || !window.confirm(t.admin.confirmStop)) return;
    setBusy(true);
    await api(`/api/admin/rooms/${room.id}/stop`, { method: "POST" });
    setBusy(false);
    writeCreated(null);
    setRoom(null);
    onCreated?.();
  };

  if (room === undefined) return <p className="shimmer text-sm">{t.common.loading}</p>;

  if (room) {
    const link = origin ? `${origin}/r/${room.id}` : "";
    return (
      <div className="w-full max-w-2xl">
        <article className="overflow-hidden border border-border bg-card">
          <div className="relative h-3">
            <CubesBand share={room.share} rows={1} />
          </div>
          <div className="grid gap-6 p-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:p-8">
            <div className="flex min-w-0 flex-col gap-5">
              <p className="eyebrow flex items-center gap-2 text-side-a">
                <Deb sides className="size-4" />
                {t.create.yours} · {t.roomStatus[room.status]}
              </p>
              <p className="font-mono text-4xl font-semibold tracking-[0.3em] uppercase">{room.id}</p>
              <p className="text-2xl font-medium tracking-tight text-balance">{room.motion}</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="border border-t-2 border-border border-t-side-a p-3">
                  <p className="eyebrow text-side-a">{t.meter.side("A")}</p>
                  <p className="mt-1 truncate font-medium">{room.stances.a}</p>
                  <p className="truncate text-sm text-muted-foreground">{room.names.a ?? t.lobby.open}</p>
                </div>
                <div className="border border-t-2 border-border border-t-side-b p-3 text-right">
                  <p className="eyebrow text-side-b">{t.meter.side("B")}</p>
                  <p className="mt-1 truncate font-medium">{room.stances.b}</p>
                  <p className="truncate text-sm text-muted-foreground">{room.names.b ?? t.lobby.open}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{t.lobby.format(room.format.rounds, room.format.challenges)}</p>
              <p className="font-mono text-xs text-muted-foreground">
                {t.admin.botLanguage}: {DICTIONARIES[room.locale].name} · {room.format.charLimit} {t.create.chars} · {t.admin.strictness}:{" "}
                {t.strictness[room.format.strictness].name.toLowerCase()}
              </p>
            </div>
            <div className="flex flex-col items-center gap-3 sm:items-end">
              <div className="bg-white p-3">{link ? <QRCodeSVG value={link} size={144} marginSize={0} /> : <div className="size-36" />}</div>
              <code className="max-w-44 truncate font-mono text-xs text-muted-foreground">{link}</code>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-border px-6 py-4 sm:px-8">
            <CopyButton value={link} label={t.admin.copyLink} />
            <Pill asChild variant="outline" size="sm">
              <a href={`/r/${room.id}`} target="_blank" rel="noreferrer">
                <ExternalLink />
                {t.admin.open}
              </a>
            </Pill>
            <Pill variant="danger" size="sm" onClick={close} disabled={busy} className="ml-auto">
              <Square />
              {t.create.close}
            </Pill>
          </div>
        </article>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid w-full max-w-2xl gap-5 sm:grid-cols-2">
      <Field label={t.admin.motion} className="sm:col-span-2">
        <input value={motion} onChange={(event) => setMotion(event.target.value)} placeholder={defaults.motionPlaceholder} maxLength={160} required className={cn(FIELD, "h-12 text-lg")} />
      </Field>
      <Field label={t.admin.stanceA}>
        <input value={stanceA} onChange={(event) => setStanceA(event.target.value)} placeholder={defaults.defaultStanceA} maxLength={40} className={cn(FIELD, "border-l-4 border-l-side-a")} />
      </Field>
      <Field label={t.admin.stanceB}>
        <input value={stanceB} onChange={(event) => setStanceB(event.target.value)} placeholder={defaults.defaultStanceB} maxLength={40} className={cn(FIELD, "border-l-4 border-l-side-b")} />
      </Field>
      <Field label={t.admin.botLanguage} className="sm:col-span-2">
        <PillSwitch
          label={t.admin.botLanguage}
          size="md"
          value={roomLocale}
          onChange={setBotLocale}
          options={LOCALES.map((option) => ({ value: option, label: DICTIONARIES[option].name }))}
        />
      </Field>
      <Field label={t.admin.rounds}>
        <Stepper value={rounds} min={1} max={6} onChange={setRounds} />
      </Field>
      <Field label={t.admin.challenges}>
        <Stepper value={challenges} min={0} max={5} onChange={setChallenges} />
      </Field>
      <Field label={t.admin.charLimit} className="sm:col-span-2">
        <Stepper value={charLimit} min={200} max={1200} step={100} onChange={setCharLimit} />
      </Field>
      <Field label={t.admin.strictness} className="sm:col-span-2">
        <PillSwitch
          label={t.admin.strictness}
          size="md"
          value={strictness}
          onChange={setStrictness}
          options={STRICTNESS_LEVELS.map((level) => ({ value: level, label: t.strictness[level].name }))}
        />
        <p className="mt-2 text-sm text-muted-foreground">{t.strictness[strictness].hint}</p>
      </Field>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Pill type="submit" size="lg" disabled={busy || !motion.trim()}>
          <Plus />
          {t.admin.create}
        </Pill>
        {error && <p className="text-sm text-destructive">{t.errors[error]}</p>}
      </div>
    </form>
  );
}
