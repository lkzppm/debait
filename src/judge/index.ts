import { groqEngine } from "./groq";
import { mockEngine } from "./mock";
import { JUDGE_MODEL_ID, MENTION_MODEL_ID } from "./models";
import type { EngineInfo, JudgeEngine } from "./types";

export { JudgeError, type JudgeErrorCode } from "./errors";
export type * from "./types";

/**
 * Which engine judges: Groq when there is an API key, the mock otherwise
 * (or when `JUDGE_ENGINE=mock` forces it, to work on the interface for free).
 */
export function engineInfo(): EngineInfo {
  const forced = process.env.JUDGE_ENGINE === "mock";
  const hasKey = Boolean(process.env.GROQ_API_KEY);
  if (forced || !hasKey) {
    return { kind: "mock", reason: forced ? "forced" : "no_api_key", models: { judge: "mock", mention: "mock" } };
  }
  return { kind: "groq", reason: null, models: { judge: JUDGE_MODEL_ID, mention: MENTION_MODEL_ID } };
}

export function getEngine(): JudgeEngine {
  return engineInfo().kind === "groq" ? groqEngine : mockEngine;
}
