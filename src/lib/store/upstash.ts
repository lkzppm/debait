import { Redis } from "@upstash/redis";
import type { KV } from "./kv";

/** Upstash Redis over REST: works from serverless functions, no connection to hold. */
export class UpstashKV implements KV {
  readonly kind = "upstash" as const;
  private redis: Redis;

  constructor(url: string, token: string) {
    // The client serialises values to JSON and parses them back on read.
    this.redis = new Redis({ url, token });
  }

  async get<T>(key: string) {
    return (await this.redis.get<T>(key)) ?? null;
  }

  async set(key: string, value: unknown, ttlSeconds?: number) {
    if (ttlSeconds) await this.redis.set(key, value, { ex: ttlSeconds });
    else await this.redis.set(key, value);
  }

  async setIfAbsent(key: string, value: string, ttlSeconds: number) {
    return (await this.redis.set(key, value, { nx: true, ex: ttlSeconds })) === "OK";
  }

  async del(...keys: string[]) {
    if (keys.length > 0) await this.redis.del(...keys);
  }

  async exists(key: string) {
    return (await this.redis.exists(key)) === 1;
  }

  async expire(key: string, ttlSeconds: number) {
    await this.redis.expire(key, ttlSeconds);
  }

  async push(key: string, value: unknown) {
    return this.redis.rpush(key, value);
  }

  async range<T>(key: string, start: number) {
    return this.redis.lrange<T>(key, start, -1);
  }

  async hashSetIfAbsent(key: string, field: string, value: unknown) {
    return (await this.redis.hsetnx(key, field, value)) === 1;
  }

  async hashAll<T>(key: string) {
    return ((await this.redis.hgetall(key)) ?? {}) as Record<string, T>;
  }

  async hashIncrement(key: string, field: string, by: number) {
    return this.redis.hincrby(key, field, by);
  }

  async sortedAdd(key: string, score: number, member: string) {
    await this.redis.zadd(key, { score, member });
  }

  async sortedList(key: string) {
    const members = await this.redis.zrange(key, 0, -1, { rev: true });
    // The client parses anything that looks like JSON, so coerce back to text.
    return members.map((member) => String(member));
  }

  async sortedRemove(key: string, member: string) {
    await this.redis.zrem(key, member);
  }
}
