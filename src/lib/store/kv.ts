/**
 * The few Redis-shaped operations the app needs. Two drivers implement it:
 * Upstash Redis for deployments, and an in-process one so `pnpm dev` works
 * with no account at all. Values are JSON; the drivers serialise.
 */
export interface KV {
  readonly kind: "upstash" | "memory";
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  /** Sets the key only if it does not exist; the atomic guard behind turns and locks. */
  setIfAbsent(key: string, value: string, ttlSeconds: number): Promise<boolean>;
  del(...keys: string[]): Promise<void>;
  exists(key: string): Promise<boolean>;
  expire(key: string, ttlSeconds: number): Promise<void>;
  /** Appends to a list and returns its new length. */
  push(key: string, value: unknown): Promise<number>;
  /** Items from `start` (0-based) to the end of the list. */
  range<T>(key: string, start: number): Promise<T[]>;
  /** Sets a hash field only if it does not exist. */
  hashSetIfAbsent(key: string, field: string, value: unknown): Promise<boolean>;
  hashAll<T>(key: string): Promise<Record<string, T>>;
  hashIncrement(key: string, field: string, by: number): Promise<number>;
  sortedAdd(key: string, score: number, member: string): Promise<void>;
  /** Members from the highest score to the lowest. */
  sortedList(key: string): Promise<string[]>;
  sortedRemove(key: string, member: string): Promise<void>;
}
