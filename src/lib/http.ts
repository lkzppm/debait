/**
 * Route handlers answer with `{ error: code }` and the browser turns the
 * code into a sentence through the dictionary, so errors are translated like
 * everything else.
 */
export type ErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "seat_taken"
  | "not_in_lobby"
  | "not_live"
  | "not_your_turn"
  | "empty"
  | "too_long"
  | "is_mention"
  | "not_a_mention"
  | "bot_busy"
  | "no_asks_left"
  | "already_checked"
  | "nothing_to_retry"
  | "server_error";

const STATUS: Record<ErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  seat_taken: 409,
  not_in_lobby: 409,
  not_live: 409,
  not_your_turn: 409,
  empty: 400,
  too_long: 400,
  is_mention: 400,
  not_a_mention: 400,
  bot_busy: 409,
  no_asks_left: 409,
  already_checked: 409,
  nothing_to_retry: 409,
  server_error: 500,
};

export class ApiError extends Error {
  constructor(readonly code: ErrorCode) {
    super(code);
    this.name = "ApiError";
  }
}

/** Runs a handler and maps what it throws to a JSON error response. */
export async function respond<T>(work: () => Promise<T>): Promise<Response> {
  try {
    return Response.json((await work()) ?? { ok: true });
  } catch (error) {
    if (error instanceof ApiError) return Response.json({ error: error.code }, { status: STATUS[error.code] });
    console.error("[api]", error);
    return Response.json({ error: "server_error" satisfies ErrorCode }, { status: 500 });
  }
}

/** The request body as an object, or an empty one when it is not JSON. */
export async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export const asString = (value: unknown): string => (typeof value === "string" ? value : "");
