"use client";

import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { CopyButton } from "@/components/site/copy-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/i18n/LocaleProvider";
import { api, type ClientError } from "@/lib/api";
import { SEATS, type DebateState, type RoomMeta, type Seat } from "@/lib/debate/types";
import { lastName, type Identity } from "@/lib/identity";
import { useOrigin } from "@/lib/use-origin";
import { cn } from "@/lib/utils";
import { sideText } from "./message-item";

interface LobbyProps {
  meta: RoomMeta;
  state: DebateState;
  identity: Identity | null;
  onJoined: (identity: Identity) => void;
}

/** Before the debate: take a side, then bring the opponent in with the link or the QR code. */
export function Lobby({ meta, state, identity, onJoined }: LobbyProps) {
  const t = useT();
  const origin = useOrigin();
  const [name, setName] = useState(lastName);
  const [joining, setJoining] = useState<Seat | null>(null);
  const [error, setError] = useState<ClientError | null>(null);
  const link = origin ? `${origin}/r/${meta.id}` : "";

  const join = async (seat: Seat) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setJoining(seat);
    setError(null);
    const result = await api<{ seat: Seat; token: string }>(`/api/rooms/${meta.id}/join`, { body: { seat, name: trimmed } });
    setJoining(null);
    if (result.ok) onJoined({ seat: result.data.seat, token: result.data.token, name: trimmed });
    else setError(result.error);
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <section className="panel rounded-3xl p-5 sm:p-6">
        <h2 className="text-lg font-semibold">{identity ? t.lobby.waitingOpponent : t.lobby.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t.lobby.format(meta.format.rounds, meta.format.challenges)}</p>

        {!identity && (
          <label className="mt-4 block text-sm">
            <span className="text-muted-foreground">{t.lobby.nameLabel}</span>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t.lobby.namePlaceholder}
              maxLength={24}
              autoComplete="nickname"
              className="mt-1 h-10 text-base"
            />
          </label>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {SEATS.map((seat) => {
            const occupant = state.seats[seat];
            const mine = identity?.seat === seat;
            return (
              <div
                key={seat}
                className={cn(
                  "rounded-2xl border p-4",
                  seat === "a" ? "border-side-a/30 bg-side-a/5" : "border-side-b/30 bg-side-b/5",
                )}
              >
                <p className={cn("text-base font-semibold", sideText(seat))}>{meta.stances[seat]}</p>
                {occupant ? (
                  <p className="mt-2 text-sm">
                    {occupant.name}
                    {mine && <span className="text-muted-foreground"> ({t.room.you})</span>}
                  </p>
                ) : identity ? (
                  <p className="mt-2 text-sm text-muted-foreground">{t.lobby.open}</p>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    className="mt-3 h-9 w-full"
                    disabled={!name.trim() || joining !== null}
                    onClick={() => join(seat)}
                  >
                    {t.lobby.join(meta.stances[seat])}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {error && <p className="mt-3 text-sm text-destructive">{t.errors[error]}</p>}
      </section>

      <section className="panel flex flex-col items-center gap-5 rounded-3xl p-5 sm:flex-row sm:items-start sm:p-6">
        <div className="rounded-2xl bg-white p-3">
          {link ? <QRCodeSVG value={link} size={148} marginSize={0} /> : <div className="size-[148px]" />}
        </div>
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <h2 className="text-lg font-semibold">{t.lobby.inviteTitle}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t.lobby.inviteHint}</p>
          <p className="mt-4 text-xs tracking-wider text-muted-foreground uppercase">{t.lobby.code}</p>
          <p className="font-mono text-3xl font-semibold tracking-[0.25em] uppercase">{meta.id}</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <code className="max-w-full truncate rounded-lg bg-muted px-2 py-1 text-xs text-muted-foreground">{link}</code>
            <CopyButton value={link} label={t.lobby.copyLink} />
          </div>
        </div>
      </section>
    </div>
  );
}
