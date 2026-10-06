import type { FallacyId } from "@/i18n/fallacies";
import type { Locale } from "@/i18n/locales";

export type Seat = "a" | "b";
export const SEATS: readonly Seat[] = ["a", "b"];
export const otherSeat = (seat: Seat): Seat => (seat === "a" ? "b" : "a");

export type RoomStatus = "lobby" | "live" | "finished";
export type EngineKind = "groq" | "mock";

export interface RoomFormat {
  /** Rounds per debater; the debate has `2 * rounds` messages. */
  rounds: number;
  /** Maximum characters of one argument. */
  charLimit: number;
  /** How many times each debater may send the bot to the web. */
  challenges: number;
}

/** What everyone in the room may know about it. */
export interface RoomMeta {
  id: string;
  motion: string;
  /** The position each side defends, as shown next to the name. */
  stances: Record<Seat, string>;
  /** The language the bot writes in (the interface language is per viewer). */
  locale: Locale;
  format: RoomFormat;
  createdAt: number;
}

// ---- What the model observes (the code does the scoring) -------------------

export interface Quality {
  logic: number;
  evidence: number;
  rebuttal: number;
  clarity: number;
}
export const QUALITY_KEYS: readonly (keyof Quality)[] = ["logic", "evidence", "rebuttal", "clarity"];

export interface FallacyFlag {
  type: FallacyId;
  /** Verbatim excerpt of the message; a flag whose quote is not found is dropped. */
  quote: string;
  explanation: string;
  severity: 1 | 2 | 3;
  confidence: number;
}

export interface Claim {
  quote: string;
  kind: "fact" | "value" | "prediction";
  checkworthy: boolean;
}

export interface Judgement {
  quality: Quality;
  fallacies: FallacyFlag[];
  claims: Claim[];
  /** The message tried to instruct the judge. */
  manipulation: boolean;
  /** One sentence shown under the message, in the room's language. */
  note: string;
  /** Rolling summary of the debate so far, fed to the next judgement. */
  summary: string;
}

export type ValidationStatus = "confirmed" | "imprecise" | "false" | "unverifiable";
export type MentionIntent = "validate" | "search" | "explain" | "off_topic";

export interface Source {
  title: string;
  url: string;
}

export interface BotReply {
  intent: MentionIntent;
  text: string;
  sources: Source[];
  /** Present only when a validation ruled on a claim of a specific message. */
  ruling: { targetMessageId: string; claimQuote: string; status: ValidationStatus } | null;
}

export interface Ruling {
  text: string;
  /** A verbatim excerpt of each side's strongest argument, when there is one. */
  best: Record<Seat, string | null>;
  advice: Record<Seat, string>;
}

// ---- The event log ---------------------------------------------------------

export type DebateEventBody =
  | { type: "room.joined"; seat: Seat; name: string }
  | { type: "room.started" }
  | { type: "debate.message"; id: string; seat: Seat; text: string }
  | { type: "debate.judgement"; messageId: string; judgement: Judgement; engine: EngineKind; model: string }
  | { type: "debate.judgement_failed"; messageId: string; error: string }
  | { type: "bot.asked"; id: string; seat: Seat; text: string; replyTo: string | null }
  | { type: "bot.replied"; askId: string; reply: BotReply; engine: EngineKind; model: string }
  | { type: "bot.failed"; askId: string; error: string }
  | { type: "room.finished"; reason: "completed" | "stopped" }
  | { type: "debate.ruling"; ruling: Ruling; engine: EngineKind; model: string };

/** An event as stored: `seq` is its position in the room's log. */
export type DebateEvent = DebateEventBody & { seq: number; at: number };

// ---- What the reducer derives ----------------------------------------------

export interface Penalty {
  /** Index into `judgement.fallacies`. */
  index: number;
  type: FallacyId;
  severity: 1 | 2 | 3;
  points: number;
}

export interface MessageScore {
  /** Weighted rubric, 0..100. */
  base: number;
  /** The fallacies that counted (confident enough, quote found). */
  penalties: Penalty[];
  /** Their sum after the cap. */
  penalty: number;
  /** What the message earned: `base - penalty`, or 0 on a manipulation attempt. */
  points: number;
  manipulation: boolean;
}

export interface MessageView {
  id: string;
  seq: number;
  at: number;
  seat: Seat;
  round: number;
  text: string;
  /** First message of the debate: there was nothing to rebut. */
  isOpening: boolean;
  judgement: Judgement | null;
  score: MessageScore | null;
  /** Last error, while there is still no judgement. */
  failed: string | null;
  engine: EngineKind | null;
  /** The bot's ruling on a claim of this message, once someone asked. */
  validation: { askId: string; claimQuote: string; status: ValidationStatus; delta: number } | null;
}

export interface AskView {
  id: string;
  seq: number;
  at: number;
  seat: Seat;
  text: string;
  replyTo: string | null;
  reply: BotReply | null;
  failed: string | null;
  engine: EngineKind | null;
  /** It used one of the debater's challenges (validate and search do). */
  charged: boolean;
  /** Its ruling moved the score. */
  applied: boolean;
}

export type TimelineItem = { kind: "message"; message: MessageView } | { kind: "ask"; ask: AskView };

export interface LedgerEntry {
  key: string;
  seq: number;
  at: number;
  /** Who gained or lost the points. */
  seat: Seat;
  round: number;
  source: "judgement" | "validation";
  messageId: string;
  askId: string | null;
  delta: number;
  manipulation: boolean;
  status: ValidationStatus | null;
  /** Meter position (share of side A) right after this entry. */
  shareAfter: number;
}

export interface DebateState {
  status: RoomStatus;
  finishedReason: "completed" | "stopped" | null;
  seats: Partial<Record<Seat, { name: string }>>;
  /** Current round, 1-based, capped at the format's rounds. */
  round: number;
  /** Whose turn it is while the debate is live. */
  turn: Seat | null;
  messages: MessageView[];
  asks: AskView[];
  timeline: TimelineItem[];
  ledger: LedgerEntry[];
  totals: Record<Seat, number>;
  /** Share of side A, 0..1. */
  share: number;
  /** The meter after each ledger entry, starting at 0.5. */
  history: number[];
  /** One side has spoken more, or a judgement is still pending. */
  provisional: boolean;
  challengesLeft: Record<Seat, number>;
  asksUsed: Record<Seat, number>;
  pendingAsk: boolean;
  averages: Record<Seat, Quality | null>;
  winner: Seat | "draw" | null;
  ruling: Ruling | null;
  /** Latest rolling summary written by the judge. */
  summary: string;
  /** True once any event came from the mock engine. */
  mock: boolean;
}
