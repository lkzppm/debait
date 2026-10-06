import type { KV } from "./kv";

interface Entry {
  value: unknown;
  expiresAt: number | null;
}

/**
 * In-process store for local development. Lives on `globalThis` so every
 * route handler and hot reload of the dev server sees the same data. It does
 * not survive a restart and is not shared between serverless instances, so a
 * deployment needs the Upstash driver.
 */
export class MemoryKV implements KV {
  readonly kind = "memory" as const;
  private data = new Map<string, Entry>();

  private read(key: string): unknown {
    const entry = this.data.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.data.delete(key);
      return undefined;
    }
    return entry.value;
  }

  private write(key: string, value: unknown, ttlSeconds?: number) {
    const previous = this.data.get(key);
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : (previous?.expiresAt ?? null);
    this.data.set(key, { value, expiresAt });
  }

  // Values cross the boundary as JSON, like they would with Redis, so callers
  // never share a mutable object with the store.
  private static copy<T>(value: unknown): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  async get<T>(key: string) {
    const value = this.read(key);
    return value === undefined ? null : MemoryKV.copy<T>(value);
  }

  async set(key: string, value: unknown, ttlSeconds?: number) {
    this.data.set(key, { value: MemoryKV.copy(value), expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null });
  }

  async setIfAbsent(key: string, value: string, ttlSeconds: number) {
    if (this.read(key) !== undefined) return false;
    this.write(key, value, ttlSeconds);
    return true;
  }

  async del(...keys: string[]) {
    for (const key of keys) this.data.delete(key);
  }

  async exists(key: string) {
    return this.read(key) !== undefined;
  }

  async expire(key: string, ttlSeconds: number) {
    const entry = this.data.get(key);
    if (entry) entry.expiresAt = Date.now() + ttlSeconds * 1000;
  }

  async push(key: string, value: unknown) {
    const list = (this.read(key) as unknown[] | undefined) ?? [];
    list.push(MemoryKV.copy(value));
    this.write(key, list);
    return list.length;
  }

  async range<T>(key: string, start: number) {
    const list = (this.read(key) as unknown[] | undefined) ?? [];
    return MemoryKV.copy<T[]>(list.slice(start));
  }

  private hash(key: string): Record<string, unknown> {
    return (this.read(key) as Record<string, unknown> | undefined) ?? {};
  }

  async hashSetIfAbsent(key: string, field: string, value: unknown) {
    const hash = this.hash(key);
    if (field in hash) return false;
    hash[field] = MemoryKV.copy(value);
    this.write(key, hash);
    return true;
  }

  async hashAll<T>(key: string) {
    return MemoryKV.copy<Record<string, T>>(this.hash(key));
  }

  async hashIncrement(key: string, field: string, by: number) {
    const hash = this.hash(key);
    const next = (Number(hash[field]) || 0) + by;
    hash[field] = next;
    this.write(key, hash);
    return next;
  }

  async sortedAdd(key: string, score: number, member: string) {
    const hash = this.hash(key);
    hash[member] = score;
    this.write(key, hash);
  }

  async sortedList(key: string) {
    return Object.entries(this.hash(key))
      .sort((x, y) => Number(y[1]) - Number(x[1]))
      .map(([member]) => member);
  }

  async sortedRemove(key: string, member: string) {
    const hash = this.hash(key);
    delete hash[member];
    this.write(key, hash);
  }
}
