"use client";

import { ArrowLeft, Receipt, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CubesField } from "@/components/cubes/cubes-canvas";
import { LocaleSwitch } from "@/components/site/locale-switch";
import { ThemeSwitch } from "@/components/site/theme-switch";
import { Logo } from "@/components/site/logo";
import { Pill, Tag } from "@/components/site/pill";
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
  open: "bg-side-b",
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
  // The ledger panel is closed until asked for, on every screen size.
  const [panelOpen, setPanelOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  const names: Record<Seat, string> = {
    a: state.seats.a?.name ?? meta.stances.a,
    b: state.seats.b?.name ?? meta.stances.b,
  };
  const live = state.status === "live";
  const canAct = identity !== null && live;

  // What the cubes react to: each ledger entry is an impact, each counted
  // fallacy or manipulation attempt a glitch.
  const lastEntry = state.ledger.at(-1);
  const pulseDir: 1 | -1 = lastEntry && (lastEntry.seat === "a") !== lastEntry.delta >= 0 ? -1 : 1;
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
    setPanelOpen(false);
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
      <CubesField
        className="fixed"
        share={state.share}
        pulse={state.ledger.length}
        pulseDir={pulseDir}
        glitch={glitch}
        provisional={state.provisional}
        intensity={0.2}
      />

      <div className="relative z-10 mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-3 p-3 sm:p-4">
        <header className="flex h-14 shrink-0 items-center gap-4 border border-border bg-popover/95 px-4">
          <Logo label={t.common.home} className="text-xl sm:text-2xl" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm sm:text-base" title={meta.motion}>
              {meta.motion}
            </h1>
            <p className="eyebrow flex items-center gap-2 text-muted-foreground">
              <span className={cn("size-1.5", CONNECTION_TONE[connection])} />
              <span className="truncate">
                {connection === "open" ? t.roomStatus[state.status] : t.room.connection[connection]}
                {live && ` · ${t.room.round(state.round, meta.format.rounds)}`}
                {live && !identity && ` · ${t.room.watching}`}
              </span>
            </p>
          </div>
          {mock && (
            <Tag className="border-warning/50 text-warning" title={t.room.mockBanner}>
              {t.common.mock}
            </Tag>
          )}
          {state.status !== "lobby" && (
            <Pill
              type="button"
              variant={panelOpen ? "primary" : "outline"}
              size="sm"
              onClick={() => setPanelOpen((open) => !open)}
              aria-expanded={panelOpen}
              aria-controls="ledger-panel"
            >
              {panelOpen ? <X /> : <Receipt />}
              <span className="hidden sm:inline">{t.panel.ledger}</span>
              {state.ledger.length > 0 && <span className="font-mono tabular-nums">{state.ledger.length}</span>}
            </Pill>
          )}
          <LocaleSwitch />
          <ThemeSwitch />
        </header>

        {connection === "gone" && events.length === 0 ? (
          <div className="panel m-auto max-w-md p-8 text-center">
            <h2 className="text-3xl font-medium tracking-tight">{t.gone.title}</h2>
            <p className="mt-2 text-muted-foreground">{t.gone.body}</p>
            <Pill asChild variant="outline" className="mt-6">
              <Link href="/">
                <ArrowLeft />
                {t.notFound.back}
              </Link>
            </Pill>
          </div>
        ) : !ready ? (
          <p className="shimmer m-auto text-sm">{t.common.loading}</p>
        ) : state.status === "lobby" ? (
          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none">
            <Lobby meta={meta} state={state} identity={identity} onJoined={setIdentity} />
          </div>
        ) : (
          <>
            <Meter meta={meta} state={state} names={names} pulse={state.ledger.length} pulseDir={pulseDir} glitch={glitch} />

            <div className="flex min-h-0 flex-1 gap-3">
              {/* Open, the panel is a column beside the feed from lg up and takes the feed's place below it. */}
              <main className={cn("min-h-0 min-w-0 flex-1 flex-col gap-3", panelOpen ? "hidden lg:flex" : "flex")}>
                <div ref={feedRef} className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto scrollbar-none pb-2">
                  {state.timeline.length === 0 && live && (
                    <p className="m-auto text-lg text-muted-foreground">{t.feed.opens(names.a)}</p>
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
                  <p className="panel p-3 text-center text-sm text-muted-foreground">{t.composer.finished}</p>
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
                  <p className="panel p-3 text-center text-sm text-muted-foreground">{t.composer.spectator}</p>
                )}
              </main>

              <aside
                id="ledger-panel"
                className={cn("panel min-h-0 w-full overflow-y-auto p-5 scrollbar-none lg:w-80 lg:shrink-0", panelOpen ? "block" : "hidden")}
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
