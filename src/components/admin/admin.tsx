"use client";

import { ExternalLink, LogOut, Plus, Square, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CopyButton } from "@/components/site/copy-button";
import { Pill } from "@/components/site/pill";
import type { EngineInfo } from "@/judge/types";
import { useLocale, useT } from "@/i18n/LocaleProvider";
import { api, type ClientError } from "@/lib/api";
import { Login } from "./login";
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

/** The admin panel: what is running, what it spent, and the rooms to stop or delete. Creating is `/create`. */
export function Admin({ authed, devHint }: { authed: boolean; devHint: boolean }) {
  const t = useT();
  return (
    <>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-6">
        <h1 className="text-3xl font-medium tracking-tight">{t.admin.title}</h1>
        {authed ? <Panel /> : <Login devHint={devHint} />}
      </div>
    </>
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
          <Rooms rooms={overview.rooms} onChanged={refresh} />
        </>
      ) : (
        <p className="shimmer text-sm">{t.common.loading}</p>
      )}
      <div className="mt-auto flex justify-between">
        <Pill asChild variant="outline" size="sm">
          <Link href="/create">
            <Plus />
            {t.admin.create}
          </Link>
        </Pill>
        <Pill variant="ghost" size="sm" onClick={signOut}>
          <LogOut />
          {t.admin.signOut}
        </Pill>
      </div>
    </>
  );
}

function Environment({ overview }: { overview: Overview }) {
  const t = useT();
  const { engine, store } = overview;
  return (
    <section className="grid gap-3 sm:grid-cols-2">
      <div className={cn("panel p-5", engine.kind === "mock" && "border-warning/40")}>
        <p className="eyebrow text-muted-foreground">{t.admin.engine}</p>
        <p className="mt-1 font-medium">{engine.kind === "groq" ? t.admin.engineGroq : t.admin.engineMock}</p>
        <p className="text-sm text-muted-foreground">
          {engine.kind === "groq"
            ? `${t.admin.judgeModel}: ${engine.models.judge} · ${t.admin.mentionModel}: ${engine.models.mention}`
            : engine.reason && t.admin.engineReason[engine.reason]}
        </p>
      </div>
      <div className={cn("panel p-5", store === "memory" && "border-warning/40")}>
        <p className="eyebrow text-muted-foreground">{t.admin.store}</p>
        <p className="mt-1 font-medium">{store === "upstash" ? t.admin.storeUpstash : t.admin.storeMemory}</p>
      </div>
    </section>
  );
}

function Bar({ label, value, max, stop }: { label: string; value: number; max: number; stop?: number }) {
  const ratio = Math.min(1, value / max);
  const tone = ratio >= (stop ?? 0.9) ? "bg-destructive" : ratio >= 0.6 ? "bg-warning" : "bg-side-a";
  return (
    <div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono tabular-nums">
          {value.toLocaleString()} / {max.toLocaleString()}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden bg-muted">
        <div className={cn("h-full transition-all", tone)} style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  );
}

function Usage({ overview }: { overview: Overview }) {
  const t = useT();
  const models = Object.entries(overview.usage);
  return (
    <section className="panel p-5">
      <h2 className="eyebrow text-side-a">{t.admin.usageTitle}</h2>
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
    <section className="panel p-5">
      <h2 className="eyebrow text-side-a">{t.admin.roomsTitle}</h2>
      {rooms.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{t.admin.roomsNone}</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="eyebrow text-muted-foreground">
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
                        "border px-2 py-0.5 text-xs",
                        room.status === "live" ? "border-side-a/60 text-side-a" : "border-border text-muted-foreground",
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
                      <Pill asChild variant="ghost" size="sm" title={t.admin.open}>
                        <a href={`/r/${room.id}`} target="_blank" rel="noreferrer" aria-label={t.admin.open}>
                          <ExternalLink />
                        </a>
                      </Pill>
                      <CopyButton value={`${origin}/r/${room.id}`} label={t.admin.copyLink} />
                      {room.status !== "finished" && (
                        <Pill variant="ghost" size="sm" onClick={() => stop(room.id)} title={t.admin.stop} aria-label={t.admin.stop}>
                          <Square />
                        </Pill>
                      )}
                      <Pill
                        variant="danger"
                        size="sm"
                        onClick={() => remove(room.id)}
                        title={t.admin.delete}
                        aria-label={t.admin.delete}
                      >
                        <Trash2 />
                      </Pill>
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
