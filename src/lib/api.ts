import type { ErrorCode } from "./http";

export type ClientError = ErrorCode | "network";
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ClientError };

/** Calls one of the app's JSON routes; failures come back as a code to translate. */
export async function api<T = unknown>(
  path: string,
  options: { method?: "GET" | "POST" | "DELETE"; body?: unknown } = {},
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(path, {
      method: options.method ?? (options.body === undefined ? "GET" : "POST"),
      headers: options.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
    });
    const data: unknown = await response.json().catch(() => null);
    if (response.ok) return { ok: true, data: data as T };
    const code = (data as { error?: ErrorCode } | null)?.error;
    return { ok: false, error: code ?? "server_error" };
  } catch {
    return { ok: false, error: "network" };
  }
}
