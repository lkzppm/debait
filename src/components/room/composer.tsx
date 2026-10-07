"use client";

import { ArrowUp, AtSign, X } from "lucide-react";
import { useState, type RefObject } from "react";
import { Pill } from "@/components/site/pill";
import { useT } from "@/i18n/LocaleProvider";
import { api, type ClientError } from "@/lib/api";
import { MENTION, mentionsBot } from "@/lib/brand";
import { MENTION_LIMIT } from "@/lib/debate/limits";
import type { DebateState, RoomMeta, Seat } from "@/lib/debate/types";
import type { Identity } from "@/lib/identity";
import { cn } from "@/lib/utils";

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

  const seat = identity.seat;
  const myTurn = state.turn === seat;
  const isMention = replyTo !== null || mentionsBot(text);
  const limit = isMention ? MENTION_LIMIT : meta.format.charLimit;
  const trimmed = text.trim();
  const challenges = state.challengesLeft[seat];
  const target = replyTo ? state.messages.find((message) => message.id === replyTo) : undefined;
  const opponent = names[seat === "a" ? "b" : "a"];

  const blocked = isMention ? state.pendingAsk : !myTurn;
  const canSend = !sending && trimmed.length > 0 && trimmed.length <= limit && !blocked;

  const callBot = () => {
    if (!mentionsBot(text)) onText(`${MENTION} ${text}`.trimEnd() + " ");
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

  return (
    <div className={cn("border border-l-2 border-border bg-card p-3", isMention ? "border-l-bot" : accent)}>
      {target && (
        <div className="mb-2 flex items-center gap-2 bg-accent px-3 py-1.5 font-mono text-xs text-muted-foreground">
          <AtSign className="size-3.5 shrink-0 text-side-a" />
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
            isMention ? "border-bot/50 font-mono text-[15px]" : "border-input focus-visible:border-side-a",
          )}
        />
        <div className="flex flex-col gap-1.5">
          <Pill type="button" variant="outline" size="icon" onClick={callBot} title={t.composer.callBot} aria-label={t.composer.callBot}>
            <AtSign />
          </Pill>
          <Pill
            type="button"
            variant={seat === "a" ? "primary" : "green"}
            size="icon"
            onClick={send}
            disabled={!canSend}
            title={t.composer.send}
            aria-label={t.composer.send}
          >
            <ArrowUp />
          </Pill>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className={cn(error ? "text-destructive" : !isMention && myTurn && (seat === "a" ? "text-side-a" : "text-side-b"))}>
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
        <span className="flex items-center gap-4 font-mono">
          {meta.format.challenges > 0 && <span>{t.composer.challenges(challenges)}</span>}
          <span className={cn("tabular-nums", trimmed.length > limit && "text-destructive")}>
            {trimmed.length}/{limit}
          </span>
        </span>
      </div>
    </div>
  );
}
