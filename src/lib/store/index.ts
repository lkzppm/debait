import type { KV } from "./kv";
import { MemoryKV } from "./memory";
import { UpstashKV } from "./upstash";

export type { KV } from "./kv";

const globalStore = globalThis as typeof globalThis & { __debaitKV?: KV };

/**
 * The store for this process: Upstash when its credentials are present (the
 * Vercel Marketplace integration injects either naming), memory otherwise.
 */
export function kv(): KV {
  if (!globalStore.__debaitKV) {
    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
    globalStore.__debaitKV = url && token ? new UpstashKV(url, token) : new MemoryKV();
  }
  return globalStore.__debaitKV;
}
