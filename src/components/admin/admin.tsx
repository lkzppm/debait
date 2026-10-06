"use client";

import { ExternalLink, LogOut, Square, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useState } from "react";
import { CopyButton } from "@/components/site/copy-button";
import { LocaleSwitch } from "@/components/site/locale-switch";
import { Logo } from "@/components/site/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { EngineInfo } from "@/judge/types";
import { useLocale, useT } from "@/i18n/LocaleProvider";
import { LOCALES, DICTIONARIES, type Locale } from "@/i18n";
import { api, type ClientError } from "@/lib/api";
import type { RoomSummary } from "@/lib/rooms";
import type { UsageByModel } from "@/lib/usage";
import { useOrigin } from "@/lib/use-origin";
import { cn } from "@/lib/utils";

interface Overview {
  rooms: RoomSummary[];
  usage: UsageByModel;
  engine: EngineInfo;
  store: "upstash" | "memory";
  limits: { tokensPerDay: number; requestsPerDay: number };
  budgetStop: number;
}

const REFRESH_MS = 5000;

/** The admin area: the only place debates are created, stopped and deleted, and where spending shows. */
export function Admin({ authed, devHint }: { authed: boolean; devHint: boolean }) {
  const t = useT();
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <Logo label={t.common.home} className="text-xl" />
          <span className="text-sm text-muted-foreground">{t.admin.title}</span>
        </div>
        <LocaleSwitch />
      </header>
      {authed ? <Panel /> : <Login devHint={devHint} />}
    </div>
  );
}

function Login({ devHint }: { devHint: boolean }) {
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
    <form onSubmit={submit} className="panel m-auto flex w-full max-w-sm flex-col gap-3 rounded-3xl p-6">
      <label className="text-sm">
        <span className="text-muted-foreground">{t.admin.password}</span>
        <Input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          autoFocus
          className="mt-1 h-10 text-base"
        />
      </label>
      <Button type="submit" className="h-10" disabled={busy || !password}>
        {t.admin.signIn}
      </Button>
      {error && <p className="text-sm text-destructive">{t.errors[error]}</p>}
      {devHint && <p className="text-xs text-warning">{t.admin.devHint}</p>}
    </form>
  );
}

function Panel() {
  const t = useT();
  const router = useRouter();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<ClientError | null>(null);

  const refresh = useCallback(async () => {
    const result = await api<Overview>("/api/admin/rooms");
    if (result.ok) {
      setOverview(result.data);
      setError(null);
    } else if (result.error === "unauthorized") {
      router.refresh();
    } else {
      setError(result.error);
    }
  }, [router]);

  // Poll so spending and room status stay current while a debate runs.
  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const timer = setInterval(refresh, REFRESH_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [refresh]);

  const signOut = async () => {
    await api("/api/admin/login", { method: "DELETE" });
    router.refresh();
  };

  return (
    <>
      {error && <p className="text-sm text-destructive">{t.errors[error]}</p>}
      {overview ? (
        <>
          <Environment overview={overview} />
          <Usage overview={overview} />
          <CreateForm onCreated={refresh} />
          <Rooms rooms={overview.rooms} onChanged={refresh} />
        </>
      ) : (
        <p className="shimmer text-sm">{t.common.loading}</p>
      )}
      <div className="mt-auto flex justify-end">
        <Button variant="ghost" size="sm" onClick={signOut}>
          <LogOut />
          {t.admin.signOut}
        </Button>
      </div>
    </>
  );
}

function Environment({ overview }: { overview: Overview }) {
  const t = useT();
  const { engine, store } = overview;
  return (
    <section className="grid gap-3 sm:grid-cols-2">
      <div className={cn("panel rounded-2xl p-4", engine.kind === "mock" && "border-warning/40")}>
        <p className="text-xs tracking-wider text-muted-foreground uppercase">{t.admin.engine}</p>
        <p className="mt-1 font-medium">{engine.kind === "groq" ? t.admin.engineGroq : t.admin.engineMock}</p>
        <p className="text-sm text-muted-foreground">
          {engine.kind === "groq"
            ? `${t.admin.judgeModel}: ${engine.models.judge} · ${t.admin.mentionModel}: ${engine.models.mention}`
            : engine.reason && t.admin.engineReason[engine.reason]}
        </p>
      </div>
      <div className={cn("panel rounded-2xl p-4", store === "memory" && "border-warning/40")}>
        <p className="text-xs tracking-wider text-muted-foreground uppercase">{t.admin.store}</p>
        <p className="mt-1 font-medium">{store === "upstash" ? t.admin.storeUpstash : t.admin.storeMemory}</p>
      </div>
    </section>
  );
}

function Bar({ label, value, max, stop }: { label: string; value: number; max: number; stop?: number }) {
  const ratio = Math.min(1, value / max);
  const tone = ratio >= (stop ?? 0.9) ? "bg-destructive" : ratio >= 0.6 ? "bg-warning" : "bg-success";
  return (
    <div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono tabular-nums">
          {value.toLocaleString()} / {max.toLocaleString()}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  );
}

function Usage({ overview }: { overview: Overview }) {
  const t = useT();
  const models = Object.entries(overview.usage);
  return (
    <section className="panel rounded-2xl p-4">
      <h2 className="font-medium">{t.admin.usageTitle}</h2>
      <p className="text-sm text-muted-foreground">{t.admin.usageHint}</p>
      {models.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{t.admin.usageNone}</p>
      ) : (
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {models.map(([model, usage]) => (
            <div key={model} className="flex flex-col gap-2">
              <p className="truncate font-mono text-sm">{model}</p>
              <Bar label={t.admin.tokens} value={usage.tokens} max={overview.limits.tokensPerDay} stop={overview.budgetStop} />
              <Bar label={t.admin.requests} value={usage.requests} max={overview.limits.requestsPerDay} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block text-sm", className)}>
      <span className="text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function CreateForm({ onCreated }: { onCreated: () => void }) {
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ClientError | null>(null);
  const [created, setCreated] = useState<string | null>(null);

  const roomLocale = botLocale ?? locale;
  const defaults = DICTIONARIES[roomLocale].admin;

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
      },
    });
    setBusy(false);
    if (result.ok) {
      setCreated(result.data.id);
      setMotion("");
      onCreated();
    } else {
      setError(result.error);
    }
  };

  const link = created && origin ? `${origin}/r/${created}` : "";
  const number = (set: (value: number) => void) => (event: React.ChangeEvent<HTMLInputElement>) => set(Number(event.target.value));

  return (
    <section className="panel rounded-2xl p-4">
      <h2 className="font-medium">{t.admin.createTitle}</h2>
      <form onSubmit={submit} className="mt-3 grid gap-3 sm:grid-cols-6">
        <Field label={t.admin.motion} className="sm:col-span-6">
          <Input
            value={motion}
            onChange={(event) => setMotion(event.target.value)}
            placeholder={defaults.motionPlaceholder}
            maxLength={160}
            required
            className="h-10 text-base"
          />
        </Field>
        <Field label={t.admin.stanceA} className="sm:col-span-3">
          <Input value={stanceA} onChange={(event) => setStanceA(event.target.value)} placeholder={defaults.defaultStanceA} maxLength={40} />
        </Field>
        <Field label={t.admin.stanceB} className="sm:col-span-3">
          <Input value={stanceB} onChange={(event) => setStanceB(event.target.value)} placeholder={defaults.defaultStanceB} maxLength={40} />
        </Field>
        <Field label={t.admin.botLanguage} className="sm:col-span-3">
          <div className="flex gap-1">
            {LOCALES.map((option) => (
              <Button
                key={option}
                type="button"
                variant={option === roomLocale ? "default" : "outline"}
                size="sm"
                onClick={() => setBotLocale(option)}
              >
                {DICTIONARIES[option].name}
              </Button>
            ))}
          </div>
        </Field>
        <Field label={t.admin.rounds}>
          <Input type="number" min={1} max={6} value={rounds} onChange={number(setRounds)} />
        </Field>
        <Field label={t.admin.challenges}>
          <Input type="number" min={0} max={5} value={challenges} onChange={number(setChallenges)} />
        </Field>
        <Field label={t.admin.charLimit}>
          <Input type="number" min={200} max={1200} step={50} value={charLimit} onChange={number(setCharLimit)} />
        </Field>
        <div className="flex items-center gap-3 sm:col-span-6">
          <Button type="submit" className="h-9" disabled={busy || !motion.trim()}>
            {t.admin.create}
          </Button>
          {error && <p className="text-sm text-destructive">{t.errors[error]}</p>}
        </div>
      </form>

      {created && (
        <div className="mt-4 flex flex-col items-center gap-4 rounded-xl border border-success/30 bg-success/5 p-4 sm:flex-row">
          <div className="rounded-xl bg-white p-2">{link && <QRCodeSVG value={link} size={112} marginSize={0} />}</div>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="text-sm text-success">{t.admin.created}</p>
            <p className="font-mono text-2xl font-semibold tracking-[0.25em] uppercase">{created}</p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <code className="max-w-full truncate rounded-lg bg-muted px-2 py-1 text-xs text-muted-foreground">{link}</code>
              <CopyButton value={link} label={t.admin.copyLink} />
              <Button asChild variant="secondary" size="sm">
                <a href={`/r/${created}`} target="_blank" rel="noreferrer">
                  <ExternalLink />
                  {t.admin.open}
                </a>
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Rooms({ rooms, onChanged }: { rooms: RoomSummary[]; onChanged: () => void }) {
  const { t, locale } = useLocale();
  const origin = useOrigin();

  const stop = async (id: string) => {
    if (!window.confirm(t.admin.confirmStop)) return;
    await api(`/api/admin/rooms/${id}/stop`, { method: "POST" });
    onChanged();
  };
  const remove = async (id: string) => {
    if (!window.confirm(t.admin.confirmDelete)) return;
    await api(`/api/admin/rooms/${id}`, { method: "DELETE" });
    onChanged();
  };

  const tokens = (room: RoomSummary) => Object.values(room.usage).reduce((sum, usage) => sum + usage.tokens, 0);
  const when = new Intl.DateTimeFormat(locale === "pt" ? "pt-BR" : "en-US", { dateStyle: "short", timeStyle: "short" });

  return (
    <section className="panel rounded-2xl p-4">
      <h2 className="font-medium">{t.admin.roomsTitle}</h2>
      {rooms.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{t.admin.roomsNone}</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs tracking-wider text-muted-foreground uppercase">
              <tr>
                <th className="pb-2 font-medium">{t.admin.colRoom}</th>
                <th className="pb-2 font-medium">{t.admin.colStatus}</th>
                <th className="pb-2 font-medium">{t.admin.colDebaters}</th>
                <th className="pb-2 text-right font-medium">{t.admin.colTokens}</th>
                <th className="pb-2 text-right font-medium">{t.admin.colCreated}</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr key={room.id} className="border-t border-border align-top">
                  <td className="py-2.5 pr-3">
                    <p className="font-mono font-semibold tracking-widest uppercase">{room.id}</p>
                    <p className="max-w-64 truncate text-muted-foreground" title={room.motion}>
                      {room.motion}
                    </p>
                  </td>
                  <td className="py-2.5 pr-3">
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-xs",
                        room.status === "live" ? "border-success/40 text-success" : "border-border text-muted-foreground",
                      )}
                    >
                      {t.roomStatus[room.status]}
                    </span>
                    <p className="mt-1 text-xs text-muted-foreground">{t.admin.messages(room.messages, room.format.rounds * 2)}</p>
                  </td>
                  <td className="py-2.5 pr-3">
                    <p className="text-side-a">{room.names.a ?? t.admin.emptySeat}</p>
                    <p className="text-side-b">{room.names.b ?? t.admin.emptySeat}</p>
                  </td>
                  <td className="py-2.5 pr-3 text-right font-mono tabular-nums">{tokens(room).toLocaleString()}</td>
                  <td className="py-2.5 pr-3 text-right text-muted-foreground">{when.format(room.createdAt)}</td>
                  <td className="py-2.5">
                    <div className="flex justify-end gap-1">
                      <Button asChild variant="ghost" size="icon-sm" title={t.admin.open}>
                        <a href={`/r/${room.id}`} target="_blank" rel="noreferrer" aria-label={t.admin.open}>
                          <ExternalLink />
                        </a>
                      </Button>
                      <CopyButton value={`${origin}/r/${room.id}`} label={t.admin.copyLink} />
                      {room.status !== "finished" && (
                        <Button variant="ghost" size="icon-sm" onClick={() => stop(room.id)} title={t.admin.stop} aria-label={t.admin.stop}>
                          <Square />
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        size="icon-sm"
                        onClick={() => remove(room.id)}
                        title={t.admin.delete}
                        aria-label={t.admin.delete}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
