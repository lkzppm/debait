"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArenaCanvas } from "@/components/arena/arena-canvas";
import { LocaleSwitch } from "@/components/site/locale-switch";
import { Logo } from "@/components/site/logo";
import { useT } from "@/i18n/LocaleProvider";
import { api } from "@/lib/api";
import { MENTION, mentionsBot } from "@/lib/brand";
import { reduce } from "@/lib/debate/reducer";
import type { EngineKind, RoomMeta, Seat } from "@/lib/debate/types";
import { useIdentity } from "@/lib/identity";
import { useRoomEvents, type Connection } from "@/lib/use-room-events";
import { cn } from "@/lib/utils";
import { AskItem } from "./ask-item";
import { Composer } from "./composer";
import { Lobby } from "./lobby";
import { MessageItem } from "./message-item";
import { Meter } from "./meter";
import { Result } from "./result";
import { ScorePanel } from "./score-panel";

const CONNECTION_TONE: Record<Connection, string> = {
  connecting: "bg-muted-foreground",
  open: "bg-success",
  reconnecting: "bg-warning",
  gone: "bg-destructive",
};

/**
 * A debate room, from lobby to result. Everything shown is derived from the
 * room's event log by the same reducer the server uses, so every screen in
 * the room (two phones, spectators, the projector) agrees.
 */
export function Room({ meta, engine }: { meta: RoomMeta; engine: EngineKind }) {
  const t = useT();
  const { events, ready, connection } = useRoomEvents(meta.id);
  const state = useMemo(() => reduce(meta, events), [meta, events]);
  const [identity, setIdentity] = useIdentity(meta.id);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [tab, setTab] = useState<"debate" | "score">("debate");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  const names: Record<Seat, string> = {
    a: state.seats.a?.name ?? meta.stances.a,
    b: state.seats.b?.name ?? meta.stances.b,
  };
  const live = state.status === "live";
  const canAct = identity !== null && live;

  // What the arena reacts to: each ledger entry is an impact, each counted
  // fallacy or manipulation attempt a glitch.
  const lastEntry = state.ledger.at(-1);
  const pulseDir = lastEntry ? ((lastEntry.seat === "a") === lastEntry.delta >= 0 ? 1 : -1) : 1;
  const glitch = state.messages.reduce(
    (count, message) => count + (message.score ? message.score.penalties.length + (message.score.manipulation ? 1 : 0) : 0),
    0,
  );

  // Follow the debate down the page unless the reader scrolled up to look at something.
  const activity = state.timeline.length + state.ledger.length + state.asks.filter((ask) => ask.reply).length;
  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;
    if (feed.scrollHeight - feed.scrollTop - feed.clientHeight < 480) {
      feed.scrollTo({ top: feed.scrollHeight, behavior: "smooth" });
    }
  }, [activity, state.status]);

  const askAbout = useCallback((messageId: string) => {
    setReplyTo(messageId);
    setText((current) => (mentionsBot(current) ? current : `${MENTION} ${current}`));
    setTab("debate");
    inputRef.current?.focus();
  }, []);

  const retry = useCallback(
    (messageId: string) => {
      if (identity) void api(`/api/rooms/${meta.id}/judge`, { body: { token: identity.token, messageId } });
    },
    [identity, meta.id],
  );

  const mock = engine === "mock" || state.mock;

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden">
      <ArenaCanvas
        className="fixed"
        share={state.share}
        pulse={state.ledger.length}
        pulseDir={pulseDir}
        glitch={glitch}
        provisional={state.provisional}
        intensity={0.5}
      />

      <div className="relative z-10 mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-3 p-3 sm:p-4">
        <header className="flex items-center gap-3">
          <Logo label={t.common.home} className="text-xl" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-medium sm:text-base" title={meta.motion}>
              {meta.motion}
            </h1>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={cn("size-1.5 rounded-full", CONNECTION_TONE[connection])} />
              <span>
                {connection === "open" ? t.roomStatus[state.status] : t.room.connection[connection]}
                {live && ` · ${t.room.round(state.round, meta.format.rounds)}`}
                {live && !identity && ` · ${t.room.watching}`}
              </span>
            </p>
          </div>
          <LocaleSwitch />
        </header>

        {mock && (
          <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-1.5 text-center text-xs text-warning">
            {t.room.mockBanner}
          </p>
        )}

        {connection === "gone" && events.length === 0 ? (
          <div className="panel m-auto max-w-md rounded-3xl p-6 text-center">
            <h2 className="text-lg font-semibold">{t.gone.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t.gone.body}</p>
            <Link href="/" className="mt-4 inline-block text-sm underline underline-offset-4">
              {t.notFound.back}
            </Link>
          </div>
        ) : !ready ? (
          <p className="shimmer m-auto text-sm">{t.common.loading}</p>
        ) : state.status === "lobby" ? (
          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none">
            <Lobby meta={meta} state={state} identity={identity} onJoined={setIdentity} />
          </div>
        ) : (
          <>
            <Meter meta={meta} state={state} names={names} />

            {/* Below lg the score panel is a second tab instead of a column. */}
            <div className="panel flex rounded-full p-0.5 text-sm lg:hidden">
              {(["debate", "score"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setTab(option)}
                  className={cn(
                    "flex-1 rounded-full py-1.5 transition-colors",
                    tab === option ? "bg-foreground text-background" : "text-muted-foreground",
                  )}
                >
                  {t.room.tabs[option]}
                  {option === "score" && state.ledger.length > 0 && ` (${state.ledger.length})`}
                </button>
              ))}
            </div>

            <div className="flex min-h-0 flex-1 gap-3">
              <main className={cn("min-h-0 min-w-0 flex-1 flex-col gap-3", tab === "debate" ? "flex" : "hidden lg:flex")}>
                <div ref={feedRef} className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto scrollbar-none pb-2">
                  {state.timeline.length === 0 && live && (
                    <p className="m-auto text-sm text-muted-foreground">{t.feed.opens(names.a)}</p>
                  )}
                  {state.timeline.map((item) =>
                    item.kind === "message" ? (
                      <MessageItem
                        key={item.message.id}
                        message={item.message}
                        name={names[item.message.seat]}
                        canAct={canAct}
                        onAsk={askAbout}
                        onRetry={retry}
                      />
                    ) : (
                      <AskItem
                        key={item.ask.id}
                        ask={item.ask}
                        names={names}
                        target={
                          state.messages.find(
                            (message) => message.id === (item.ask.reply?.ruling?.targetMessageId ?? item.ask.replyTo),
                          ) ?? null
                        }
                      />
                    ),
                  )}
                  {state.status === "finished" && <Result state={state} names={names} />}
                </div>

                {state.status === "finished" ? (
                  <p className="panel rounded-2xl p-3 text-center text-sm text-muted-foreground">{t.composer.finished}</p>
                ) : identity ? (
                  <Composer
                    meta={meta}
                    state={state}
                    identity={identity}
                    names={names}
                    text={text}
                    onText={setText}
                    replyTo={replyTo}
                    onReplyTo={setReplyTo}
                    inputRef={inputRef}
                  />
                ) : (
                  <p className="panel rounded-2xl p-3 text-center text-sm text-muted-foreground">{t.composer.spectator}</p>
                )}
              </main>

              <aside
                className={cn(
                  "panel min-h-0 w-full overflow-y-auto rounded-2xl p-4 scrollbar-none lg:block lg:w-80 lg:shrink-0",
                  tab === "score" ? "block" : "hidden",
                )}
              >
                <ScorePanel meta={meta} state={state} names={names} />
              </aside>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
