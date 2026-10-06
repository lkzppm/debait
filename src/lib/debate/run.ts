import { nanoid } from "nanoid";
import { getEngine, JudgeError } from "@/judge";
import type { TranscriptLine } from "@/judge/types";
import { mentionsBot } from "@/lib/brand";
import { ApiError } from "@/lib/http";
import { appendEvent, finishRoom, loadRoom, requireRoom, ROOM_TTL, seatOf, toMeta } from "@/lib/rooms";
import { kv } from "@/lib/store";
import { FREE_ASKS, MENTION_LIMIT, STALE_MS } from "./limits";
import { describeScoreboard, isComplete } from "./reducer";
import { decideWinner, normalizeJudgement, normalizeReply } from "./scoring";
import type { DebateState, MessageView } from "./types";

/**
 * What happens on the server when a debater acts. Each move has two halves:
 * a fast one that validates and appends to the log (the route answers right
 * after), and a slow one that calls the model and appends the outcome (run
 * with `after()` once the response is out).
 */

const line = (message: MessageView): TranscriptLine => ({
  id: message.id,
  seat: message.seat,
  round: message.round,
  text: message.text,
});

/** Failures reach the room as a code; the details stay in the server log. */
function failureCode(error: unknown): string {
  console.error("[judge]", error);
  return error instanceof JudgeError && error.code === "budget_exceeded" ? "budget" : "failed";
}

// ---- Arguments --------------------------------------------------------------

export async function postMessage(rawId: string, token: string, rawText: string): Promise<{ id: string }> {
  const { room, state } = await requireRoom(rawId);
  const seat = await seatOf(room.id, token);
  if (!seat) throw new ApiError("forbidden");

  const text = rawText.trim();
  if (!text) throw new ApiError("empty");
  if (text.length > room.format.charLimit) throw new ApiError("too_long");
  if (mentionsBot(text)) throw new ApiError("is_mention");
  if (state.status !== "live") throw new ApiError("not_live");
  if (state.turn !== seat) throw new ApiError("not_your_turn");

  // Two taps or two tabs must not both take the same turn.
  if (!(await kv().setIfAbsent(`room:${room.id}:turn:${state.messages.length}`, seat, ROOM_TTL))) {
    throw new ApiError("not_your_turn");
  }
  const id = nanoid(10);
  await appendEvent(room.id, { type: "debate.message", id, seat, text });
  return { id };
}

export async function runJudgement(roomId: string, messageId: string): Promise<void> {
  const loaded = await loadRoom(roomId);
  if (!loaded) return;
  const { room, events, state } = loaded;
  const index = state.messages.findIndex((message) => message.id === messageId);
  const message = state.messages[index];
  if (!message || message.judgement) return;

  // One attempt at a time; a retry after a recorded failure gets a fresh lock.
  const failures = events.filter((event) => event.type === "debate.judgement_failed" && event.messageId === messageId).length;
  if (!(await kv().setIfAbsent(`room:${roomId}:judging:${messageId}:${failures}`, "1", STALE_MS / 1000))) return;

  const previous = state.messages[index - 1];
  try {
    const result = await getEngine().judgeMessage({
      roomId,
      locale: room.locale,
      motion: room.motion,
      stances: room.stances,
      seat: message.seat,
      round: message.round,
      isOpening: message.isOpening,
      text: message.text,
      previous: previous ? { seat: previous.seat, text: previous.text } : null,
      summary: state.summary,
    });
    await appendEvent(roomId, {
      type: "debate.judgement",
      messageId,
      judgement: normalizeJudgement(result.value),
      engine: result.engine,
      model: result.model,
    });
  } catch (error) {
    await appendEvent(roomId, { type: "debate.judgement_failed", messageId, error: failureCode(error) });
  }
  await finishIfComplete(roomId);
}

/** A debater asks for a judgement that failed, or got lost, to be tried again. */
export async function retryJudgement(rawId: string, token: string, messageId: string): Promise<void> {
  const { room, state } = await requireRoom(rawId);
  if (!(await seatOf(room.id, token))) throw new ApiError("forbidden");
  const message = state.messages.find((candidate) => candidate.id === messageId);
  if (!message || message.judgement) throw new ApiError("nothing_to_retry");
  if (!message.failed && Date.now() - message.at < STALE_MS) throw new ApiError("nothing_to_retry");
}

/** Closes the debate once its last message has been judged, and writes the ruling. */
export async function finishIfComplete(roomId: string): Promise<void> {
  const loaded = await loadRoom(roomId);
  if (!loaded || !isComplete(toMeta(loaded.room), loaded.state)) return;
  const { room, state } = loaded;
  if (!(await finishRoom(room, "completed"))) return;

  if (state.ledger.length === 0) return;
  try {
    const result = await getEngine().writeRuling({
      roomId,
      locale: room.locale,
      motion: room.motion,
      stances: room.stances,
      winner: decideWinner(state.share),
      totals: state.totals,
      share: state.share,
      scoreboard: describeScoreboard(state),
      transcript: state.messages.map(line),
      summary: state.summary,
    });
    const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");
    const ruling = result.value;
    await appendEvent(roomId, {
      type: "debate.ruling",
      ruling: {
        text: text(ruling.text, 1500),
        best: { a: text(ruling.best?.a, 400) || null, b: text(ruling.best?.b, 400) || null },
        advice: { a: text(ruling.advice?.a, 400), b: text(ruling.advice?.b, 400) },
      },
      engine: result.engine,
      model: result.model,
    });
  } catch (error) {
    // The result screen works from the numbers alone; the written ruling is a bonus.
    console.error("[ruling]", error);
  }
}

// ---- Calls to the bot ---------------------------------------------------------

function hasFreshPendingAsk(state: DebateState): boolean {
  return state.asks.some((ask) => !ask.reply && !ask.failed && Date.now() - ask.at < STALE_MS);
}

export async function postMention(
  rawId: string,
  token: string,
  rawText: string,
  replyTo: string | null,
): Promise<{ id: string }> {
  const { room, state } = await requireRoom(rawId);
  const seat = await seatOf(room.id, token);
  if (!seat) throw new ApiError("forbidden");

  const text = rawText.trim();
  if (!text) throw new ApiError("empty");
  if (text.length > MENTION_LIMIT) throw new ApiError("too_long");
  if (!mentionsBot(text)) throw new ApiError("not_a_mention");
  if (state.status !== "live") throw new ApiError("not_live");
  if (hasFreshPendingAsk(state)) throw new ApiError("bot_busy");
  if (state.asksUsed[seat] >= room.format.challenges + FREE_ASKS) throw new ApiError("no_asks_left");

  if (replyTo !== null) {
    const target = state.messages.find((message) => message.id === replyTo);
    if (!target) throw new ApiError("bad_request");
    if (target.validation) throw new ApiError("already_checked");
  }

  if (!(await kv().setIfAbsent(`room:${room.id}:ask:${state.asks.length}`, seat, ROOM_TTL))) {
    throw new ApiError("bot_busy");
  }
  const id = nanoid(10);
  await appendEvent(room.id, { type: "bot.asked", id, seat, text, replyTo });
  return { id };
}

export async function runMention(roomId: string, askId: string): Promise<void> {
  const loaded = await loadRoom(roomId);
  if (!loaded) return;
  const { room, state } = loaded;
  const ask = state.asks.find((candidate) => candidate.id === askId);
  if (!ask || ask.reply || ask.failed) return;
  if (!(await kv().setIfAbsent(`room:${roomId}:answering:${askId}`, "1", STALE_MS / 1000))) return;

  const canSearch = state.challengesLeft[ask.seat] > 0;
  const target = ask.replyTo ? state.messages.find((message) => message.id === ask.replyTo) : undefined;
  try {
    const result = await getEngine().answerMention({
      roomId,
      locale: room.locale,
      motion: room.motion,
      stances: room.stances,
      seat: ask.seat,
      text: ask.text,
      replyTo: target ? line(target) : null,
      recent: state.messages.slice(-6).map(line),
      summary: state.summary,
      scoreboard: describeScoreboard(state),
      canSearch,
    });

    // Only messages not yet ruled on can receive a ruling.
    const open = new Set(state.messages.filter((message) => !message.validation).map((message) => message.id));
    const reply = normalizeReply(result.value, open, target?.id ?? null);
    // Without a challenge left the bot may explain, never search or rule.
    if (!canSearch && (reply.intent === "validate" || reply.intent === "search")) {
      reply.intent = "explain";
      reply.ruling = null;
    }
    await appendEvent(roomId, { type: "bot.replied", askId, reply, engine: result.engine, model: result.model });
  } catch (error) {
    await appendEvent(roomId, { type: "bot.failed", askId, error: failureCode(error) });
  }
}
