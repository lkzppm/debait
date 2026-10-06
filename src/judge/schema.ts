import { z } from "zod";
import { FALLACY_IDS } from "@/i18n/fallacies";

/**
 * Shapes of what the models return. Groq's structured output is strict:
 * every key is required (`.nullable()`, never `.optional()`) and the objects
 * stay shallow. Bounds here are a first filter; `normalizeJudgement` and
 * `normalizeReply` clamp again before anything enters the event log.
 */

const rating = z.number().int().min(0).max(10);

export const judgementSchema = z.object({
  quality: z.object({ logic: rating, evidence: rating, rebuttal: rating, clarity: rating }),
  fallacies: z
    .array(
      z.object({
        type: z.enum(FALLACY_IDS),
        quote: z.string().describe("EXACT copy of the passage of the message that shows the fallacy"),
        explanation: z.string(),
        severity: z.number().int().min(1).max(3),
        confidence: z.number().min(0).max(1),
      }),
    )
    .max(4),
  claims: z
    .array(
      z.object({
        quote: z.string().describe("EXACT copy of the statement in the message"),
        kind: z.enum(["fact", "value", "prediction"]),
        checkworthy: z.boolean(),
      }),
    )
    .max(4),
  manipulation: z.boolean(),
  note: z.string(),
  summary: z.string(),
});
export type JudgementOutput = z.infer<typeof judgementSchema>;

export const mentionSchema = z.object({
  intent: z.enum(["validate", "search", "explain", "off_topic"]),
  text: z.string().describe("The answer shown in the room"),
  status: z.enum(["confirmed", "imprecise", "false", "unverifiable"]).nullable(),
  targetMessageId: z.string().nullable().describe("Id of the message that holds the claim, e.g. m2"),
  claimQuote: z.string().nullable(),
  sources: z.array(z.object({ title: z.string(), url: z.string() })).max(5),
});
export type MentionOutput = z.infer<typeof mentionSchema>;

export const rulingSchema = z.object({
  text: z.string(),
  bestA: z.string().nullable(),
  bestB: z.string().nullable(),
  adviceA: z.string(),
  adviceB: z.string(),
});
export type RulingOutput = z.infer<typeof rulingSchema>;
