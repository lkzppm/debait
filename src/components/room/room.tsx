"use client";

import { ArrowLeft, Info, Receipt, Trophy } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { LEVEL_FACE } from "@/components/admin/level-picker";
import { CubesField } from "@/components/cubes/cubes-canvas";
import { Deb } from "@/components/site/deb";
import { Dialog } from "@/components/site/dialog";
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
import { CoinFlip } from "./coin-flip";
import { Composer } from "./composer";
import { Lobby } from "./lobby";
import { MessageItem } from "./message-item";
import { Meter } from "./meter";
import { Result } from "./result";
import { RoomFacts } from "./room-facts";
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
  // The ledger and the result are popups, closed until asked for.
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
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

  // At the end the meter shows the winner in brief, with a trophy that opens the full result.
  const finished = state.status === "finished";

  const askAbout = useCallback((messageId: string) => {
    setReplyTo(messageId);
    setText((current) => (mentionsBot(current) ? current : `${MENTION} ${current}`));
    inputRef.current?.focus();
  }, []);

  const retry = useCallback(
    (messageId: string) => {
      if (identity) void api(`/api/rooms/${meta.id}/judge`, { body: { token: identity.token, messageId } });
    },
    [identity, meta.id],
  );

  const mock = engine === "mock" || state.mock;
  const level = `${t.admin.strictness}: ${t.strictness[meta.format.strictness].name}`;

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

      <div className="relative z-10 mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-2 p-2 sm:gap-3 sm:p-4">
        {/* On a phone the bar keeps Deb, the motion and the two popup buttons; the rest returns from sm up. */}
        <header className="flex h-12 shrink-0 items-center gap-2 border border-border bg-popover/95 px-3 sm:h-14 sm:gap-4 sm:px-4">
          <Logo label={t.common.home} short className="text-xl sm:text-2xl" />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <h1 className="truncate text-sm sm:text-base" title={meta.motion}>
                {meta.motion}
              </h1>
              {/* The room's rules, beside the motion they are for. */}
              <button
                type="button"
                onClick={() => setRulesOpen(true)}
                aria-haspopup="dialog"
                aria-label={t.room.rules}
                title={t.room.rules}
                className="grid size-6 shrink-0 place-items-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Info className="size-4" />
              </button>
            </div>
            <p className="eyebrow flex items-center gap-2 text-muted-foreground">
              <span className={cn("size-1.5", CONNECTION_TONE[connection])} />
              <span className="truncate">
                {connection === "open" ? t.roomStatus[state.status] : t.room.connection[connection]}
                {live && ` · ${t.room.round(state.round, meta.format.rounds)}`}
                {live && !identity && ` · ${t.room.watching}`}
              </span>
            </p>
          </div>
          {/* Deb's level as her face for it: pleased, neutral or stern. */}
          <span
            role="img"
            aria-label={level}
            title={`${level}. ${t.strictness[meta.format.strictness].hint}`}
            className="grid size-8 shrink-0 place-items-center border border-input text-bot"
          >
            <Deb mood={LEVEL_FACE[meta.format.strictness]} className="size-4" />
          </span>
          {mock && (
            <Tag className="border-warning/50 text-warning" title={t.room.mockBanner}>
              {t.common.mock}
            </Tag>
          )}
          <LocaleSwitch />
          <ThemeSwitch className="hidden sm:grid" />
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
            <Meter
              meta={meta}
              state={state}
              names={names}
              pulse={state.ledger.length}
              pulseDir={pulseDir}
              glitch={glitch}
              onResult={() => setResultOpen(true)}
            />

            <main className="relative flex min-h-0 min-w-0 flex-1 flex-col gap-3">
              {/* Floating over the feed's top right corner, as Deb's help floats over its bottom one. */}
              <button
                type="button"
                onClick={() => setLedgerOpen(true)}
                aria-haspopup="dialog"
                aria-label={t.panel.ledger}
                title={t.panel.ledger}
                className="absolute -top-1 right-2 z-10 grid size-10 sm:-top-1.5 place-items-center border border-border bg-popover shadow-lg shadow-black/20 transition-[background-color,scale] hover:scale-110 hover:bg-accent sm:right-3"
              >
                <Receipt className="size-5" />
              </button>
              {/* Room at the bottom for Deb's floating help button over the composer. */}
              <div
                ref={feedRef}
                // Faded at both edges, with padding so the first and last messages rest clear of the fade.
                className={cn(
                  "fade-y flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto scrollbar-none pt-5",
                  identity && !finished ? "pb-14" : "pb-8",
                )}
              >
                  {state.timeline.length === 0 && live && (
                    <CoinFlip opener={state.opener} names={names} />
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
              </div>

              {finished ? (
                <div className="panel flex flex-wrap items-center justify-center gap-3 p-3 text-sm text-muted-foreground">
                  <span>{t.composer.finished}</span>
                  {/* With no winner (stopped before any score) the meter has no trophy: the result opens from here. */}
                  {!state.winner && (
                    <Pill type="button" variant="outline" size="sm" onClick={() => setResultOpen(true)}>
                      <Trophy />
                      {t.result.open}
                    </Pill>
                  )}
                </div>
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
          </>
        )}
      </div>

      <Dialog open={ledgerOpen} onOpenChange={setLedgerOpen} title={t.panel.ledger} className="max-w-lg">
        <div className="p-6 sm:p-8">
          <ScorePanel meta={meta} state={state} names={names} />
        </div>
      </Dialog>

      <Dialog open={rulesOpen} onOpenChange={setRulesOpen} title={t.room.rules} className="max-w-md">
        <div className="flex flex-col gap-4 p-6 sm:p-8">
          <div className="pr-8">
            <p className="eyebrow text-muted-foreground">{t.room.rules}</p>
            <h2 className="mt-2 text-xl font-medium tracking-tight text-balance">{meta.motion}</h2>
          </div>
          <RoomFacts meta={meta} stacked />
        </div>
      </Dialog>

      <Dialog open={resultOpen} onOpenChange={setResultOpen} title={t.result.title} className="max-w-3xl">
        <Result state={state} names={names} />
      </Dialog>
    </div>
  );
}
