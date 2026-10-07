import { decideWinner, meterShare, scoreMessage, STRICTNESS } from "./scoring";
import {
  QUALITY_KEYS,
  type AskView,
  type DebateEvent,
  type DebateState,
  type LedgerEntry,
  type MessageView,
  type Quality,
  type RoomMeta,
  type Seat,
} from "./types";

/**
 * A room is an append-only list of events; everything on screen is derived
 * from it here. The server runs this to validate a move and to name the
 * winner, the browser runs it to render, so a refreshed tab, a spectator
 * and the projector all reach the same state from the same log.
 */
export function reduce(room: RoomMeta, events: readonly DebateEvent[]): DebateState {
  const state: DebateState = {
    status: "lobby",
    finishedReason: null,
    seats: {},
    round: 1,
    turn: null,
    messages: [],
    asks: [],
    timeline: [],
    ledger: [],
    totals: { a: 0, b: 0 },
    share: 0.5,
    history: [0.5],
    provisional: false,
    challengesLeft: { a: room.format.challenges, b: room.format.challenges },
    asksUsed: { a: 0, b: 0 },
    pendingAsk: false,
    averages: { a: null, b: null },
    winner: null,
    ruling: null,
    summary: "",
    mock: false,
  };

  const messages = new Map<string, MessageView>();
  const asks = new Map<string, AskView>();

  const post = (entry: Omit<LedgerEntry, "shareAfter" | "key">) => {
    // Totals never go below zero: the meter's share needs non-negative sides.
    state.totals[entry.seat] = Math.max(0, state.totals[entry.seat] + entry.delta);
    const shareAfter = meterShare(state.totals.a, state.totals.b);
    state.ledger.push({ ...entry, key: `${entry.source}:${entry.askId ?? entry.messageId}`, shareAfter });
    state.history.push(shareAfter);
  };

  for (const event of events) {
    switch (event.type) {
      case "room.joined":
        state.seats[event.seat] = { name: event.name };
        break;

      case "room.started":
        state.status = "live";
        break;

      case "debate.message": {
        const message: MessageView = {
          id: event.id,
          seq: event.seq,
          at: event.at,
          seat: event.seat,
          round: Math.floor(state.messages.length / 2) + 1,
          text: event.text,
          isOpening: state.messages.length === 0,
          judgement: null,
          score: null,
          failed: null,
          engine: null,
          validation: null,
        };
        messages.set(message.id, message);
        state.messages.push(message);
        state.timeline.push({ kind: "message", message });
        break;
      }

      case "debate.judgement": {
        const message = messages.get(event.messageId);
        if (!message || message.judgement) break;
        message.judgement = event.judgement;
        message.score = scoreMessage(message.text, event.judgement, message.isOpening, room.format.strictness);
        message.failed = null;
        message.engine = event.engine;
        if (event.engine === "mock") state.mock = true;
        if (event.judgement.summary) state.summary = event.judgement.summary;
        post({
          seq: event.seq,
          at: event.at,
          seat: message.seat,
          round: message.round,
          source: "judgement",
          messageId: message.id,
          askId: null,
          delta: message.score.points,
          manipulation: message.score.manipulation,
          status: null,
        });
        break;
      }

      case "debate.judgement_failed": {
        const message = messages.get(event.messageId);
        if (message && !message.judgement) message.failed = event.error;
        break;
      }

      case "bot.asked": {
        const ask: AskView = {
          id: event.id,
          seq: event.seq,
          at: event.at,
          seat: event.seat,
          text: event.text,
          replyTo: event.replyTo,
          reply: null,
          failed: null,
          engine: null,
          charged: false,
          applied: false,
        };
        asks.set(ask.id, ask);
        state.asks.push(ask);
        state.asksUsed[ask.seat] += 1;
        state.timeline.push({ kind: "ask", ask });
        break;
      }

      case "bot.replied": {
        const ask = asks.get(event.askId);
        if (!ask || ask.reply) break;
        ask.reply = event.reply;
        ask.failed = null;
        ask.engine = event.engine;
        if (event.engine === "mock") state.mock = true;
        // Sending the bot to the web is what costs a challenge.
        ask.charged = event.reply.intent === "validate" || event.reply.intent === "search";
        if (ask.charged) state.challengesLeft[ask.seat] = Math.max(0, state.challengesLeft[ask.seat] - 1);

        const ruling = event.reply.ruling;
        const target = ruling ? messages.get(ruling.targetMessageId) : undefined;
        // One ruling per message, so a confirmed claim cannot be farmed for points.
        if (ruling && target && !target.validation) {
          const delta = STRICTNESS[room.format.strictness].validation[ruling.status];
          target.validation = { askId: ask.id, claimQuote: ruling.claimQuote, status: ruling.status, delta };
          ask.applied = true;
          post({
            seq: event.seq,
            at: event.at,
            seat: target.seat,
            round: target.round,
            source: "validation",
            messageId: target.id,
            askId: ask.id,
            delta,
            manipulation: false,
            status: ruling.status,
          });
        }
        break;
      }

      case "bot.failed": {
        const ask = asks.get(event.askId);
        if (ask && !ask.reply) ask.failed = event.error;
        break;
      }

      case "room.finished":
        state.status = "finished";
        state.finishedReason = event.reason;
        break;

      case "debate.ruling":
        state.ruling = event.ruling;
        if (event.engine === "mock") state.mock = true;
        break;
    }
  }

  const sent = state.messages.length;
  const total = room.format.rounds * 2;
  state.round = Math.min(room.format.rounds, Math.floor(sent / 2) + 1);
  state.turn = state.status === "live" && sent < total ? (sent % 2 === 0 ? "a" : "b") : null;
  state.share = meterShare(state.totals.a, state.totals.b);
  state.pendingAsk = state.asks.some((ask) => !ask.reply && !ask.failed);
  state.provisional =
    state.status !== "finished" && (sent % 2 === 1 || state.messages.some((message) => !message.judgement));
  state.averages = { a: averageQuality(state.messages, "a"), b: averageQuality(state.messages, "b") };
  if (state.status === "finished" && state.ledger.length > 0) state.winner = decideWinner(state.share);

  return state;
}

function averageQuality(messages: readonly MessageView[], seat: Seat): Quality | null {
  const judged = messages.filter((message) => message.seat === seat && message.judgement);
  if (judged.length === 0) return null;
  const average = { logic: 0, evidence: 0, rebuttal: 0, clarity: 0 };
  for (const key of QUALITY_KEYS) {
    // The opening message has nothing to rebut and is left out of that average.
    const counted = key === "rebuttal" ? judged.filter((message) => !message.isOpening) : judged;
    average[key] =
      counted.length === 0 ? 0 : counted.reduce((sum, message) => sum + message.judgement!.quality[key], 0) / counted.length;
  }
  return average;
}

/** True when every message of a full-length debate has been judged (or gave up). */
export function isComplete(room: RoomMeta, state: DebateState): boolean {
  return (
    state.status === "live" &&
    state.messages.length >= room.format.rounds * 2 &&
    state.messages.every((message) => message.judgement || message.failed)
  );
}

/**
 * The scoreboard as compact text, for the prompts that explain a ruling.
 * Language-neutral on purpose: ids and numbers, the model does the wording.
 */
export function describeScoreboard(state: DebateState): string {
  const side = (seat: Seat) => (seat === "a" ? "A" : "B");
  const lines = state.messages.map((message, index) => {
    const head = `m${index + 1} (side ${side(message.seat)}, round ${message.round})`;
    if (!message.score || !message.judgement) return `${head}: not judged yet`;
    const { score, judgement } = message;
    const q = judgement.quality;
    const parts = [
      `${score.points} points = base ${score.base} - penalties ${score.penalty}`,
      `rubric logic ${q.logic}, evidence ${q.evidence}, rebuttal ${message.isOpening ? "n/a" : q.rebuttal}, clarity ${q.clarity}`,
    ];
    if (score.manipulation) parts.push("manipulation attempt: scored 0");
    for (const penalty of score.penalties) {
      parts.push(`${penalty.type} (-${penalty.points}): "${judgement.fallacies[penalty.index].quote}"`);
    }
    if (message.validation) {
      parts.push(`claim checked: ${message.validation.status} (${message.validation.delta >= 0 ? "+" : ""}${message.validation.delta})`);
    }
    return `${head}: ${parts.join("; ")}`;
  });
  lines.push(
    `totals: side A ${state.totals.a}, side B ${state.totals.b}; meter: A ${Math.round(state.share * 100)}%, B ${100 - Math.round(state.share * 100)}%`,
  );
  return lines.join("\n");
}
