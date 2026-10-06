/**
 * Failures the room can show without leaking provider details. The message
 * is the code, so it survives being stored in a failure event.
 */
export type JudgeErrorCode = "rate_limited" | "budget_exceeded" | "truncated" | "invalid_output" | "engine_error";

export class JudgeError extends Error {
  readonly code: JudgeErrorCode;

  constructor(code: JudgeErrorCode, cause?: unknown) {
    super(code, { cause });
    this.name = "JudgeError";
    this.code = code;
  }
}
