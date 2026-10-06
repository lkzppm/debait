import { createGroq } from "@ai-sdk/groq";

/**
 * Groq provider and the two models the bot runs on. Groq's rate limits are
 * per model, so the judge and the mention each get their own budget.
 * Docs: https://console.groq.com/docs/models
 */

/** Structured judgement and the closing ruling. Only the 120b held large schemas in CV-AI's tests. */
export const JUDGE_MODEL_ID = process.env.GROQ_JUDGE_MODEL || "openai/gpt-oss-120b";

/** The @mention. Needs the built-in `browser_search` tool, available only on `openai/gpt-oss-*`. */
export const MENTION_MODEL_ID = process.env.GROQ_MENTION_MODEL || "openai/gpt-oss-20b";

let provider: ReturnType<typeof createGroq> | undefined;

/** Created on first use, so importing this file never needs the API key. */
export function groq() {
  provider ??= createGroq({ apiKey: process.env.GROQ_API_KEY });
  return provider;
}

export const judgeModel = () => groq()(JUDGE_MODEL_ID);
export const mentionModel = () => groq()(MENTION_MODEL_ID);
