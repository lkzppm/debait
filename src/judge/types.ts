import type { Locale } from "@/i18n/locales";
import type { BotReply, EngineKind, Judgement, Ruling, Seat, Strictness } from "@/lib/debate/types";

/**
 * The contract between the room and whatever does the judging. Two engines
 * implement it: Groq (the real one) and a mock that needs no API key.
 * Debaters are only ever "side A" and "side B" here: the judge never sees names.
 */

export interface DebateContext {
  roomId: string;
  /** The language the bot must write in. */
  locale: Locale;
  motion: string;
  stances: Record<Seat, string>;
}

export interface TranscriptLine {
  id: string;
  seat: Seat;
  round: number;
  text: string;
}

export interface JudgeInput extends DebateContext {
  /** The room's level: sets the prompt's calibration (the penalty table is the code's side). */
  strictness: Strictness;
  seat: Seat;
  round: number;
  /** First message of the debate: there is nothing to rebut. */
  isOpening: boolean;
  /** The message to judge. Untrusted: it is material to evaluate, never instructions. */
  text: string;
  /** The opponent's previous message, needed for straw man and for the rebuttal rating. */
  previous: { seat: Seat; text: string } | null;
  /** Rolling summary written by the previous judgement ("" at the start). */
  summary: string;
}

export interface MentionInput extends DebateContext {
  /** Who called the bot. */
  seat: Seat;
  /** What they wrote, with the @handle. Untrusted, like any debater text. */
  text: string;
  /** The message they replied to, when they picked one. */
  replyTo: TranscriptLine | null;
  /** The latest messages, oldest first, for context and as possible targets. */
  recent: TranscriptLine[];
  summary: string;
  /** The scoreboard as text (`describeScoreboard`), for explaining a ruling. */
  scoreboard: string;
  /** False when the debater has no challenges left: answer without the web. */
  canSearch: boolean;
}

export interface RulingInput extends DebateContext {
  winner: Seat | "draw";
  totals: Record<Seat, number>;
  /** Share of side A, 0..1. */
  share: number;
  scoreboard: string;
  transcript: TranscriptLine[];
  summary: string;
}

export interface EngineResult<T> {
  value: T;
  engine: EngineKind;
  model: string;
}

export interface JudgeEngine {
  judgeMessage(input: JudgeInput): Promise<EngineResult<Judgement>>;
  answerMention(input: MentionInput): Promise<EngineResult<BotReply>>;
  writeRuling(input: RulingInput): Promise<EngineResult<Ruling>>;
}

export interface EngineInfo {
  kind: EngineKind;
  /** Why the mock is in use, when it is. */
  reason: "no_api_key" | "forced" | null;
  models: { judge: string; mention: string };
}
