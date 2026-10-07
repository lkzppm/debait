"use client";

import { ArrowUp, AtSign, CornerDownLeft, Globe, Info, Receipt, Reply, SearchCheck, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState, type RefObject } from "react";
import { Deb } from "@/components/site/deb";
import { Dialog } from "@/components/site/dialog";
import { Pill, Tag } from "@/components/site/pill";
import { useT } from "@/i18n/LocaleProvider";
import { api, type ClientError } from "@/lib/api";
import { BRAND, MENTION, mentionsBot } from "@/lib/brand";
import { MENTION_LIMIT } from "@/lib/debate/limits";
import type { DebateState, RoomMeta, Seat } from "@/lib/debate/types";
import type { Identity } from "@/lib/identity";
import { cn } from "@/lib/utils";
import { Mention } from "./ask-item";
import { sideText } from "./message-item";

/** One per help item, in order: check a claim, search, the score, point at a message. */
const HELP_ICONS = [SearchCheck, Globe, Receipt, Reply];

interface ComposerProps {
  meta: RoomMeta;
  state: DebateState;
  identity: Identity;
  names: Record<Seat, string>;
  text: string;
  onText: (text: string) => void;
  /** The message a call to the bot is about, when the debater picked one. */
  replyTo: string | null;
  onReplyTo: (messageId: string | null) => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
}

/**
 * One field for both kinds of move. Text that mentions the bot goes to the
 * bot and can be sent at any time; anything else is an argument and needs
 * the debater's turn.
 */
export function Composer({ meta, state, identity, names, text, onText, replyTo, onReplyTo, inputRef }: ComposerProps) {
  const t = useT();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<ClientError | null>(null);
  const [help, setHelp] = useState(false);
  // The tool open in the help's list.
  const [tool, setTool] = useState(0);

  const seat = identity.seat;
  const myTurn = state.turn === seat;
  const isMention = replyTo !== null || mentionsBot(text);
  const limit = isMention ? MENTION_LIMIT : meta.format.charLimit;
  const trimmed = text.trim();
  const challenges = state.challengesLeft[seat];
  const target = replyTo ? state.messages.find((message) => message.id === replyTo) : undefined;
  const opponent = names[seat === "a" ? "b" : "a"];
  const current = t.composer.helpItems[tool];

  const blocked = isMention ? state.pendingAsk : !myTurn;
  const canSend = !sending && trimmed.length > 0 && trimmed.length <= limit && !blocked;

  /** From the help popup: starts a call to the bot in the field. */
  const tryMention = () => {
    setHelp(false);
    if (!mentionsBot(text)) onText(`${MENTION} ${text}`.trimEnd() + " ");
    inputRef.current?.focus();
  };

  /** From the help popup: an example lands in the field, unless it would overwrite a drafted argument. */
  const write = (example: string) => {
    setHelp(false);
    onText(!trimmed || mentionsBot(text) ? `${example} ` : `${example} ${text}`);
    inputRef.current?.focus();
  };

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    setError(null);
    const body = isMention
      ? { token: identity.token, text: mentionsBot(trimmed) ? trimmed : `${MENTION} ${trimmed}`, replyTo }
      : { token: identity.token, text: trimmed };
    const result = await api(`/api/rooms/${meta.id}/${isMention ? "mention" : "messages"}`, { body });
    setSending(false);
    if (result.ok) {
      onText("");
      onReplyTo(null);
    } else {
      setError(result.error);
    }
  };

  const placeholder = isMention ? t.composer.placeholderMention : myTurn ? t.composer.placeholderTurn : t.composer.placeholderWait(opponent);
  const accent = seat === "a" ? "border-l-side-a" : "border-l-side-b";
  // The field lights up in the writer's colour, or Deb's while it holds a call to her.
  const focus = seat === "a" ? "focus-visible:border-side-a" : "focus-visible:border-side-b";

  return (
    <div className={cn("relative border border-l-2 border-border bg-card p-2.5 sm:p-3", isMention ? "border-l-bot" : accent)}>
      {/* Floating over the feed's bottom right corner: what a message with @deb can do. */}
      <button
        type="button"
        onClick={() => setHelp(true)}
        aria-haspopup="dialog"
        aria-expanded={help}
        aria-label={t.composer.help}
        title={t.composer.help}
        className="absolute right-2 bottom-full mb-2.5 grid size-10 place-items-center rounded-full border border-bot/30 bg-popover text-bot shadow-lg shadow-black/20 transition-[background-color,scale] hover:scale-110 hover:bg-accent sm:right-3"
      >
        <Info className="size-5" />
      </button>

      {target && (
        <div className="mb-2 flex items-center gap-2 bg-accent px-3 py-1.5 font-mono text-xs text-muted-foreground">
          <Reply className="size-3.5 shrink-0 text-bot" />
          <span className="min-w-0 flex-1 truncate">
            {t.composer.replyingTo(names[target.seat])}: {target.text}
          </span>
          <button type="button" onClick={() => onReplyTo(null)} aria-label={t.composer.clearReply} className="hover:text-foreground">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={text}
          onChange={(event) => {
            onText(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void send();
            }
          }}
          rows={2}
          maxLength={limit + 200}
          placeholder={placeholder}
          aria-label={placeholder}
          // 16px on phones: iOS Safari zooms the page when a smaller field takes focus.
          className={cn(
            "max-h-40 min-h-[3.5rem] flex-1 resize-none border bg-background px-3 py-2.5 text-base outline-none placeholder:text-muted-foreground/70",
            isMention ? "border-bot/50 font-mono focus-visible:border-bot sm:text-[15px]" : cn("border-input", focus),
          )}
        />
        <Pill
          type="button"
          variant={seat === "a" ? "primary" : "green"}
          size="icon"
          onClick={send}
          disabled={!canSend}
          title={t.composer.send}
          aria-label={t.composer.send}
          className="self-end"
        >
          <ArrowUp />
        </Pill>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className={cn("min-w-0 flex-1", error ? "text-destructive" : !isMention && myTurn && (seat === "a" ? "text-side-a" : "text-side-b"))}>
          {error
            ? t.errors[error]
            : isMention
              ? challenges > 0
                ? t.composer.mentionHint
                : t.composer.noChallenges
              : myTurn
                ? t.room.yourTurn
                : t.room.turnOf(opponent)}
        </span>
        <span className={cn("font-mono tabular-nums", trimmed.length > limit && "text-destructive")}>
          {trimmed.length}/{limit}
        </span>
      </div>

      <Dialog open={help} onOpenChange={setHelp} title={t.composer.help}>
        <div className="flex flex-col gap-5 p-6 sm:p-8">
          <div className="flex items-center gap-3 pr-8">
            <Deb mood="good" sides className="size-10" />
            <div>
              <p className="eyebrow text-muted-foreground">{BRAND.bot.name}</p>
              <h2 className="text-2xl font-medium tracking-tight">{t.composer.help}</h2>
            </div>
          </div>
          <p className="-mt-1 text-muted-foreground">{t.composer.helpLead}</p>

          {/* Deb's tools as a list on the left; the chosen one is explained on the right. */}
          <div className="grid border border-border sm:grid-cols-[13rem_minmax(0,1fr)]">
            <div role="tablist" aria-orientation="vertical" aria-label={t.composer.help} className="flex flex-col border-b border-border p-1.5 sm:border-r sm:border-b-0">
              {t.composer.helpItems.map((item, index) => {
                const Icon = HELP_ICONS[index];
                const active = index === tool;
                return (
                  <button
                    key={index}
                    type="button"
                    role="tab"
                    id={`deb-tool-${index}`}
                    aria-selected={active}
                    aria-controls="deb-tool-panel"
                    onClick={() => setTool(index)}
                    className={cn(
                      "relative isolate flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors",
                      active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="deb-tool"
                        className="absolute inset-0 -z-10 bg-bot/10"
                        transition={{ type: "spring", stiffness: 500, damping: 40 }}
                      />
                    )}
                    <Icon className={cn("size-4 shrink-0", active && "text-bot")} />
                    <span className="min-w-0 flex-1 truncate">{item.title}</span>
                  </button>
                );
              })}
            </div>

            <div id="deb-tool-panel" role="tabpanel" aria-labelledby={`deb-tool-${tool}`} className="min-h-56 p-5">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={tool}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.15 }}
                  className="flex h-full flex-col gap-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-medium">{current.title}</h3>
                    <Tag className={current.free ? "text-muted-foreground" : cn("border-current", sideText(seat))}>
                      {current.free ? t.composer.helpFree : t.composer.helpCharged}
                    </Tag>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">{current.body}</p>
                  {current.example ? (
                    // An example to start from: it lands in the field, ready to edit or send.
                    <button
                      type="button"
                      onClick={() => write(current.example!)}
                      title={t.composer.helpTry}
                      className="group mt-auto flex items-center gap-2 border border-dashed border-bot/30 px-3 py-2 text-left font-mono text-xs transition-colors hover:border-bot/60 hover:bg-bot/5"
                    >
                      <Mention text={current.example} />
                      <CornerDownLeft className="ml-auto size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-bot" />
                    </button>
                  ) : (
                    // What the arrow looks like beside Deb's bubble.
                    <div className="mt-auto flex items-center gap-2">
                      <span className="rounded-2xl rounded-tl-sm border border-bot/25 px-3 py-1.5">
                        <Deb mood="good" className="size-4 text-bot" />
                      </span>
                      <span className="grid size-7 place-items-center rounded-full border border-bot/30 text-bot">
                        <Reply className="size-3.5" />
                      </span>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            {meta.format.challenges > 0 ? (
              <span className="inline-flex items-center gap-2" aria-label={t.composer.challenges(challenges)}>
                <span className="flex gap-0.5">
                  {Array.from({ length: meta.format.challenges }, (_, index) => (
                    <AtSign key={index} className={cn("size-4", index < challenges ? sideText(seat) : "text-muted-foreground/30")} />
                  ))}
                </span>
                <span className="font-mono text-xs text-muted-foreground">{t.composer.challenges(challenges)}</span>
              </span>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Pill type="button" variant="outline" size="sm" onClick={() => setHelp(false)}>
                {t.common.close}
              </Pill>
              <Pill type="button" variant={seat === "a" ? "primary" : "green"} size="sm" onClick={tryMention}>
                <AtSign />
                {t.composer.callBot}
              </Pill>
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
