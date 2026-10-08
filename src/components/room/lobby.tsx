"use client";

import { ArrowRight, Share2 } from "lucide-react";
import { useState } from "react";
import { CopyButton } from "@/components/site/copy-button";
import { Dialog } from "@/components/site/dialog";
import { Pill } from "@/components/site/pill";
import { RoomQr } from "@/components/site/room-qr";
import { useT } from "@/i18n/LocaleProvider";
import { api, type ClientError } from "@/lib/api";
import { SEATS, type DebateState, type RoomMeta, type Seat } from "@/lib/debate/types";
import { lastName, type Identity } from "@/lib/identity";
import { useOrigin } from "@/lib/use-origin";
import { cn } from "@/lib/utils";
import { sideText } from "./message-item";
import { RoomFacts } from "./room-facts";

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
  const [sharing, setSharing] = useState(false);
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
    // Centred in the room's height; with the invitation in a popup everything fits on one screen.
    <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col justify-center gap-4 py-4">
      <section className="px-1 text-center">
        <p className="eyebrow text-side-a">{identity ? t.lobby.waitingOpponent : t.lobby.title}</p>
        <h2 className="headline mt-4 text-3xl leading-tight font-medium tracking-tight text-balance sm:text-6xl">{meta.motion}</h2>
        <RoomFacts meta={meta} className="mt-5" />
      </section>

      {!identity && (
        <label className="mx-auto mt-4 block w-full max-w-sm text-center">
          <span className="eyebrow text-muted-foreground">{t.lobby.nameLabel}</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t.lobby.namePlaceholder}
            maxLength={24}
            autoComplete="nickname"
            className="mt-2 h-12 w-full border border-input bg-popover px-6 text-center text-base outline-none focus-visible:border-side-a"
          />
        </label>
      )}

      <div className="mt-2 grid gap-4 sm:grid-cols-2">
        {SEATS.map((seat) => {
          const occupant = state.seats[seat];
          const mine = identity?.seat === seat;
          return (
            <section key={seat} className={cn("border border-t-2 border-border bg-card p-4 sm:p-6", seat === "a" ? "border-t-side-a" : "border-t-side-b")}>
              <p className={cn("text-2xl font-medium tracking-tight sm:text-3xl", sideText(seat))}>{meta.stances[seat]}</p>
              <div className="mt-6 flex min-h-10 items-center">
                {occupant ? (
                  <p className="text-lg">
                    <span className={seat === "a" ? "mark-a" : "mark-b"}>{occupant.name}</span>
                    {mine && <span className="ml-2 text-sm text-muted-foreground">({t.room.you})</span>}
                  </p>
                ) : identity ? (
                  <p className="text-muted-foreground">{t.lobby.open}</p>
                ) : (
                  <Pill
                    type="button"
                    variant={seat === "a" ? "primary" : "green"}
                    className="w-full"
                    disabled={!name.trim() || joining !== null}
                    onClick={() => join(seat)}
                  >
                    {t.lobby.join(meta.stances[seat])}
                    <ArrowRight />
                  </Pill>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {error && <p className="text-center text-sm text-destructive">{t.errors[error]}</p>}

      {/* The invitation is a popup, so the lobby fits on one screen and the QR code can be big. */}
      <div className="flex justify-center">
        <Pill type="button" variant="outline" onClick={() => setSharing(true)} aria-haspopup="dialog">
          <Share2 />
          {t.lobby.share}
        </Pill>
      </div>

      <Dialog open={sharing} onOpenChange={setSharing} title={t.lobby.share} className="max-w-md">
        <div className="flex flex-col items-center gap-5 p-6 sm:p-8">
          <RoomQr link={link} size={260} />
          <p className="font-mono text-4xl font-semibold tracking-[0.3em] uppercase sm:text-5xl">{meta.id}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <CopyButton value={link} label={t.lobby.copyLink} />
            <CopyButton value={meta.id.toUpperCase()} label={t.lobby.copyCode} />
          </div>
        </div>
      </Dialog>
    </div>
  );
}
