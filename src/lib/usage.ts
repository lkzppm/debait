import { kv } from "./store";

/**
 * Token accounting for the Groq free tier. Every model call reports here, so
 * the admin panel can show what a debate costs and the app can refuse new
 * calls before the provider does.
 */

/** Groq free-tier limits per model, read from its docs on 2026-10-06. */
export const LIMITS = {
  tokensPerDay: 200_000,
  requestsPerDay: 1_000,
  tokensPerMinute: 8_000,
  requestsPerMinute: 30,
} as const;

/** Share of the daily tokens after which new calls are refused. */
export const BUDGET_STOP = 0.9;

export interface ModelUsage {
  tokens: number;
  input: number;
  output: number;
  requests: number;
}

export type UsageByModel = Record<string, ModelUsage>;

export class BudgetError extends Error {
  constructor(model: string) {
    super(`Daily token budget reached for ${model}`);
    this.name = "BudgetError";
  }
}

const SEPARATOR = "|";
const USAGE_TTL = 60 * 60 * 24 * 14;

/** The provider's daily window may be rolling; a UTC calendar day is our approximation. */
export function usageDay(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

const dayKey = (day: string) => `usage:${day}`;
export const roomUsageKey = (roomId: string) => `room:${roomId}:usage`;

export async function addUsage(
  roomId: string | null,
  model: string,
  usage: { input: number; output: number; total: number },
): Promise<void> {
  const store = kv();
  const keys = [dayKey(usageDay()), ...(roomId ? [roomUsageKey(roomId)] : [])];
  const fields: [string, number][] = [
    ["tokens", usage.total || usage.input + usage.output],
    ["input", usage.input],
    ["output", usage.output],
    ["requests", 1],
  ];
  await Promise.all(
    keys.flatMap((key) =>
      fields.map(([field, by]) => store.hashIncrement(key, `${model}${SEPARATOR}${field}`, Math.round(by) || 0)),
    ),
  );
  await Promise.all(keys.map((key) => store.expire(key, USAGE_TTL)));
}

function group(hash: Record<string, unknown>): UsageByModel {
  const usage: UsageByModel = {};
  for (const [key, value] of Object.entries(hash)) {
    const at = key.lastIndexOf(SEPARATOR);
    if (at === -1) continue;
    const model = key.slice(0, at);
    const field = key.slice(at + 1) as keyof ModelUsage;
    usage[model] ??= { tokens: 0, input: 0, output: 0, requests: 0 };
    if (field in usage[model]) usage[model][field] = Number(value) || 0;
  }
  return usage;
}

export async function getDailyUsage(day = usageDay()): Promise<UsageByModel> {
  return group(await kv().hashAll(dayKey(day)));
}

export async function getRoomUsage(roomId: string): Promise<UsageByModel> {
  return group(await kv().hashAll(roomUsageKey(roomId)));
}

/** Call before spending tokens: throws once the model is near its daily limit. */
export async function checkBudget(model: string): Promise<void> {
  const usage = (await getDailyUsage())[model];
  if (usage && usage.tokens >= LIMITS.tokensPerDay * BUDGET_STOP) throw new BudgetError(model);
}
