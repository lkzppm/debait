"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { AskItem } from "@/components/room/ask-item";
import { MessageItem } from "@/components/room/message-item";
import { Meter } from "@/components/room/meter";
import { ScorePanel } from "@/components/room/score-panel";
import { useLocale } from "@/i18n/LocaleProvider";
import { BRAND, MENTION } from "@/lib/brand";
import { reduce } from "@/lib/debate/reducer";
import type { DebateEvent, DebateEventBody, DebateState, RoomMeta, Seat } from "@/lib/debate/types";
import { cn } from "@/lib/utils";

/* One short debate (two messages and a call to the bot), played with the
   room's own pieces. The debate is a scripted event log; each step shows a
   longer prefix of it, reduced by the same `reduce()` the room uses, so the
   scores, the ledger and the meter are the scoring code's, not typed in.
   The focus walks the steps on its own, follows the pointer on the step
   buttons, and only pauses while the pointer is over them. */

const NAMES: Record<Seat, string> = { a: "Ana", b: "Bia" };
/** Bloom et al., "Does Working from Home Work?", QJE 2015: the study the demo's claim is about. */
const SOURCE_URL = "https://doi.org/10.1093/qje/qju032";

/** The steps, and how long the focus rests on each (milliseconds). */
const STEPS = ["argue", "scored", "attack", "flagged", "call", "checked"] as const;
const REST = [2000, 3000, 2200, 3400, 2600, 5000];
const LAST = STEPS.length - 1;
/** How many events of the script each step shows (the first three seat the debaters and start). */
const SHOWN = [4, 5, 6, 7, 8, 9];
const CALL = STEPS.indexOf("call");

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
function subscribeReducedMotion(listener: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

const ignore = () => {};

function Piece({ label, className, children }: { label?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("min-w-0", className)}>
      {label && (
        <p className="eyebrow mb-3 flex items-center gap-2 text-muted-foreground">
          <span className="size-1.5 bg-current" />
          {label}
        </p>
      )}
      {children}
    </div>
  );
}

/**
 * Lays invisible copies of the larger states under the current one, in the
 * same grid cell: the box is as tall as the tallest of them from the start,
 * so nothing below moves while pieces arrive.
 */
function Settled({ ghosts, ghostClassName, children }: { ghosts: React.ReactNode[]; ghostClassName?: string; children: React.ReactNode }) {
  // One column that may shrink: an auto track would take the widest line of text, unwrapped.
  return (
    <div className="grid grid-cols-[minmax(0,1fr)]">
      {ghosts.map((ghost, index) => (
        <div key={index} aria-hidden inert className={cn("invisible col-start-1 row-start-1", ghostClassName)}>
          {ghost}
        </div>
      ))}
      <div className="col-start-1 row-start-1">{children}</div>
    </div>
  );
}

/** The chat as the room draws it: messages with Deb's bubbles, and the call to her. */
function Feed({ state }: { state: DebateState }) {
  return (
    <div className="flex flex-col gap-5">
      {state.timeline.map((item) =>
        item.kind === "message" ? (
          <MessageItem key={item.message.id} message={item.message} name={NAMES[item.message.seat]} canAct={false} onAsk={ignore} onRetry={ignore} />
        ) : (
          <AskItem
            key={item.ask.id}
            ask={item.ask}
            names={NAMES}
            target={state.messages.find((message) => message.id === (item.ask.reply?.ruling?.targetMessageId ?? item.ask.replyTo)) ?? null}
          />
        ),
      )}
    </div>
  );
}

export function Demo() {
  const { t, locale } = useLocale();
  const d = t.home.demo;
  const reduced = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
  // `chosen` is null until the walk or the visitor moves it: with reduced
  // motion the figure then rests on its last step, complete.
  const [chosen, setChosen] = useState<number | null>(null);
  // When the call to Deb went out: her bubble shows "working" for a while after it.
  const [askedAt, setAskedAt] = useState(0);
  const [hovered, setHovered] = useState(false);
  const step = chosen ?? (reduced ? LAST : 0);

  const go = (next: number) => {
    if (next === CALL) setAskedAt(Date.now());
    setChosen(next);
  };

  useEffect(() => {
    if (hovered || reduced) return;
    const id = setTimeout(() => go((step + 1) % STEPS.length), REST[step]);
    return () => clearTimeout(id);
  }, [step, hovered, reduced]);

  const meta: RoomMeta = useMemo(
    () => ({
      id: "demo",
      motion: "",
      stances: { a: t.admin.defaultStanceA, b: t.admin.defaultStanceB },
      locale,
      format: { rounds: 1, charLimit: 600, challenges: 3, strictness: "balanced" },
      createdAt: 0,
    }),
    [locale, t],
  );

  // The script, and the room after each step of it.
  const states = useMemo(() => {
    const [before, flagged, after] = d.second;
    const quiet = { manipulation: false, summary: "" };
    const script: DebateEventBody[] = [
      { type: "room.joined", seat: "a", name: NAMES.a },
      { type: "room.joined", seat: "b", name: NAMES.b },
      { type: "room.started" },
      { type: "debate.message", id: "m1", seat: "a", text: d.first },
      {
        type: "debate.judgement",
        messageId: "m1",
        engine: "groq",
        model: "demo",
        judgement: {
          ...quiet,
          quality: { logic: 8, evidence: 8, rebuttal: 0, clarity: 7 },
          fallacies: [],
          claims: [{ quote: d.claim, kind: "fact", checkworthy: true }],
          note: d.notes[0],
        },
      },
      { type: "debate.message", id: "m2", seat: "b", text: before + flagged + after },
      {
        type: "debate.judgement",
        messageId: "m2",
        engine: "groq",
        model: "demo",
        judgement: {
          ...quiet,
          quality: { logic: 4, evidence: 3, rebuttal: 5, clarity: 6 },
          fallacies: [{ type: "ad_hominem", quote: flagged, explanation: d.explanation, severity: 2, confidence: 0.9 }],
          claims: [],
          note: d.notes[1],
        },
      },
      { type: "bot.asked", id: "k1", seat: "b", text: `${MENTION} ${d.ask}`, replyTo: "m1" },
      {
        type: "bot.replied",
        askId: "k1",
        engine: "groq",
        model: "demo",
        reply: {
          intent: "validate",
          text: d.answer,
          sources: [{ title: d.source, url: SOURCE_URL }],
          ruling: { targetMessageId: "m1", claimQuote: d.claim, status: "confirmed" },
        },
      },
    ];
    // Only the call carries a real time: Deb's bubble works out from it whether the answer is overdue.
    const events = script.map((body, seq) => ({ ...body, seq, at: body.type.startsWith("bot.") ? askedAt : 0 }) as DebateEvent);
    return SHOWN.map((count) => reduce(meta, events.slice(0, count)));
  }, [meta, d, askedAt]);

  const state = states[step];
  const final = states[LAST];
  const [first, second] = final.messages;

  // What the meter reacts to, as in the room.
  const lastEntry = state.ledger.at(-1);
  const pulseDir: 1 | -1 = lastEntry && (lastEntry.seat === "a") !== lastEntry.delta >= 0 ? -1 : 1;
  const glitch = state.messages.reduce((count, message) => count + (message.score?.penalties.length ?? 0), 0);

  const captions = [
    d.steps.argue(NAMES.a),
    d.steps.scored(first.score?.points ?? 0),
    d.steps.attack(NAMES.b),
    d.steps.flagged(t.fallacies.ad_hominem.name, second.score?.penalty ?? 0),
    d.steps.call(NAMES.b),
    d.steps.checked(first.validation?.delta ?? 0, NAMES.a),
  ];

  return (
    <figure aria-label={d.title(BRAND.name)}>
      <div className="grid gap-x-12 gap-y-8 sm:gap-y-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <Piece label={d.chat} className="lg:row-span-2">
          <Settled ghosts={[<Feed key="final" state={final} />]}>
            <Feed state={state} />
          </Settled>
        </Piece>

        <Piece label={d.meter}>
          <Meter meta={meta} state={state} names={NAMES} pulse={state.ledger.length} pulseDir={pulseDir} glitch={glitch} />
          <p className="mt-3 text-sm text-muted-foreground">{d.note}</p>
        </Piece>

        {/* Beside the chat (lg) the ledger takes only the height it needs: the chat already holds the figure's height.
            Stacked under it, it keeps the final height so the page below does not move. */}
        <Piece className="panel p-5 lg:self-start">
          <Settled ghosts={[<ScorePanel key="final" meta={meta} state={final} names={NAMES} />]} ghostClassName="lg:hidden">
            <ScorePanel meta={meta} state={state} names={NAMES} />
          </Settled>
        </Piece>
      </div>

      {/* The steps: one square each, and what is happening in words. */}
      <figcaption className="mt-10 flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center">
        <span className="flex gap-1.5" onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)}>
          {STEPS.map((id, index) => (
            <button
              key={id}
              type="button"
              aria-label={captions[index]}
              aria-current={index === step ? "step" : undefined}
              onPointerEnter={() => go(index)}
              onFocus={() => go(index)}
              onClick={() => go(index)}
              className="group grid size-8 place-items-center outline-none"
            >
              <span
                className={cn(
                  "size-3.5 transition-[background-color,scale] duration-300 group-hover:scale-125 group-focus-visible:ring-2 group-focus-visible:ring-ring",
                  index === step ? "scale-125 bg-foreground" : index < step ? "bg-muted-foreground/60" : "bg-border",
                )}
              />
            </button>
          ))}
        </span>
        <div className="min-w-0 flex-1 font-mono text-sm">
          {/* Every caption laid in the same cell, so a longer one never pushes the page. */}
          <Settled ghosts={captions.map((caption, index) => <Caption key={index} index={index} text={caption} />)}>
            <Caption index={step} text={captions[step]} />
          </Settled>
        </div>
      </figcaption>
    </figure>
  );
}

function Caption({ index, text }: { index: number; text: string }) {
  return (
    <p>
      <span className="mr-3 text-muted-foreground">
        {String(index + 1).padStart(2, "0")}/{String(STEPS.length).padStart(2, "0")}
      </span>
      {text}
    </p>
  );
}
