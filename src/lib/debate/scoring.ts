import { isFallacyId } from "@/i18n/fallacies";
import { findQuote } from "./quote";
import type { BotReply, Judgement, MessageScore, Penalty, Quality, Strictness, ValidationStatus } from "./types";

/**
 * The model observes, the code scores. Everything that turns a judgement
 * into points lives in this file, so the arithmetic is the same for every
 * message, can be shown on screen, and cannot be talked out of by a debater.
 */

export const WEIGHTS: Quality = { logic: 0.35, evidence: 0.25, rebuttal: 0.25, clarity: 0.15 };

export interface PenaltyTable {
  /** A flag below this confidence is neither shown nor counted. */
  confidenceMin: number;
  /** Points lost per severity level of a counted fallacy. */
  fallacyUnit: number;
  /** Most a single message can lose to fallacies. */
  fallacyCap: number;
  /** What a ruling of the bot is worth to the author of the claim. */
  validation: Record<ValidationStatus, number>;
}

/**
 * The three levels of the judge, chosen when the room is created. The prompt
 * changes its calibration with the level (`judge/prompts`); this table is the
 * code's half of it: how much a fallacy or a false claim costs.
 */
export const STRICTNESS: Record<Strictness, PenaltyTable> = {
  lenient: {
    confidenceMin: 0.85,
    fallacyUnit: 4,
    fallacyCap: 20,
    validation: { confirmed: 10, imprecise: -5, false: -10, unverifiable: 0 },
  },
  balanced: {
    confidenceMin: 0.7,
    fallacyUnit: 8,
    fallacyCap: 40,
    validation: { confirmed: 10, imprecise: -10, false: -20, unverifiable: 0 },
  },
  strict: {
    confidenceMin: 0.6,
    fallacyUnit: 12,
    fallacyCap: 60,
    validation: { confirmed: 10, imprecise: -15, false: -30, unverifiable: 0 },
  },
};

export const DEFAULT_STRICTNESS: Strictness = "balanced";

// The balanced numbers, for the figures on the landing page.
export const CONFIDENCE_MIN = STRICTNESS.balanced.confidenceMin;
export const FALLACY_UNIT = STRICTNESS.balanced.fallacyUnit;
export const FALLACY_CAP = STRICTNESS.balanced.fallacyCap;
export const VALIDATION_DELTA = STRICTNESS.balanced.validation;

/** Pseudo-points each side starts with, so the first message does not slam the meter to one end. */
export const METER_PRIOR = 50;
/** A final gap under this many points of share (of 1) is a draw. */
export const DRAW_BAND = 0.03;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** A fallacy counts when the judge is confident and really quoted the message. */
export function countedFallacies(text: string, judgement: Judgement, strictness: Strictness = DEFAULT_STRICTNESS): Penalty[] {
  const table = STRICTNESS[strictness];
  const penalties: Penalty[] = [];
  judgement.fallacies.forEach((flag, index) => {
    if (flag.confidence < table.confidenceMin) return;
    if (!findQuote(text, flag.quote)) return;
    penalties.push({ index, type: flag.type, severity: flag.severity, points: table.fallacyUnit * flag.severity });
  });
  return penalties;
}

/**
 * base    = 10 x weighted rubric (0..100)
 * penalty = min(cap, sum of unit x severity over the counted fallacies)
 * points  = manipulation ? 0 : clamp(base - penalty, 0, 100)
 *
 * The unit and the cap come from the room's strictness (8 and 40 when balanced).
 * The opening message has nothing to rebut, so its rubric is the weighted
 * average of the other three dimensions.
 */
export function scoreMessage(text: string, judgement: Judgement, isOpening: boolean, strictness: Strictness = DEFAULT_STRICTNESS): MessageScore {
  const q = judgement.quality;
  const weighted = isOpening
    ? (WEIGHTS.logic * q.logic + WEIGHTS.evidence * q.evidence + WEIGHTS.clarity * q.clarity) / (1 - WEIGHTS.rebuttal)
    : WEIGHTS.logic * q.logic + WEIGHTS.evidence * q.evidence + WEIGHTS.rebuttal * q.rebuttal + WEIGHTS.clarity * q.clarity;
  const base = Math.round(clamp(weighted, 0, 10) * 10);
  const penalties = countedFallacies(text, judgement, strictness);
  const penalty = Math.min(
    STRICTNESS[strictness].fallacyCap,
    penalties.reduce((sum, p) => sum + p.points, 0),
  );
  const points = judgement.manipulation ? 0 : clamp(base - penalty, 0, 100);
  return { base, penalties, penalty, points, manipulation: judgement.manipulation };
}

/** Share of side A, 0..1. */
export function meterShare(totalA: number, totalB: number): number {
  return (totalA + METER_PRIOR) / (totalA + totalB + 2 * METER_PRIOR);
}

export function decideWinner(share: number): "a" | "b" | "draw" {
  if (Math.abs(share - (1 - share)) < DRAW_BAND) return "draw";
  return share > 0.5 ? "a" : "b";
}

// ---- Bounding what a model may hand us --------------------------------------

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const rating = (value: unknown) => Math.round(clamp(Number(value) || 0, 0, 10));

/**
 * Whatever engine produced the judgement, clamp it before it enters the log:
 * ratings to 0..10, severities to 1..3, known fallacy ids only, short lists
 * and short strings. A hijacked model can then at worst award one good message.
 */
export function normalizeJudgement(raw: Judgement): Judgement {
  return {
    quality: {
      logic: rating(raw.quality?.logic),
      evidence: rating(raw.quality?.evidence),
      rebuttal: rating(raw.quality?.rebuttal),
      clarity: rating(raw.quality?.clarity),
    },
    fallacies: (raw.fallacies ?? [])
      .filter((flag) => isFallacyId(flag.type) && text(flag.quote, 400).length > 0)
      .slice(0, 4)
      .map((flag) => ({
        type: flag.type,
        quote: text(flag.quote, 400),
        explanation: text(flag.explanation, 500),
        severity: clamp(Math.round(Number(flag.severity) || 1), 1, 3) as 1 | 2 | 3,
        confidence: clamp(Number(flag.confidence) || 0, 0, 1),
      })),
    claims: (raw.claims ?? [])
      .filter((claim) => text(claim.quote, 400).length > 0)
      .slice(0, 4)
      .map((claim) => ({
        quote: text(claim.quote, 400),
        kind: claim.kind === "value" || claim.kind === "prediction" ? claim.kind : "fact",
        checkworthy: Boolean(claim.checkworthy),
      })),
    manipulation: Boolean(raw.manipulation),
    note: text(raw.note, 400),
    summary: text(raw.summary, 1200),
  };
}

function safeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Bounds a bot reply. Two rules are enforced here and not left to the prompt:
 * a ruling must point at a real message, and no source means no ruling
 * (the status becomes "unverifiable").
 */
export function normalizeReply(raw: BotReply, validTargets: ReadonlySet<string>, forcedTarget: string | null): BotReply {
  const sources = (raw.sources ?? [])
    .map((source) => ({ title: text(source.title, 160), url: safeUrl(source.url) }))
    .filter((source): source is { title: string; url: string } => source.url !== null)
    .slice(0, 5)
    .map((source) => ({ title: source.title || new URL(source.url).hostname, url: source.url }));

  const intent =
    raw.intent === "validate" || raw.intent === "search" || raw.intent === "explain" ? raw.intent : "off_topic";

  let ruling: BotReply["ruling"] = null;
  if (intent === "validate" && raw.ruling) {
    const target = forcedTarget ?? raw.ruling.targetMessageId;
    if (validTargets.has(target)) {
      const claimed = raw.ruling.status;
      const known = claimed === "confirmed" || claimed === "imprecise" || claimed === "false";
      ruling = {
        targetMessageId: target,
        claimQuote: text(raw.ruling.claimQuote, 400),
        status: known && sources.length > 0 ? claimed : "unverifiable",
      };
    }
  }

  return { intent, text: text(raw.text, 1500), sources, ruling };
}
