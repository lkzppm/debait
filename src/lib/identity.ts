"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Seat } from "./debate/types";

/**
 * Who this browser is in a room. There are no accounts: joining returns a
 * seat token, kept in localStorage per room and sent with every move. The
 * server stores only its hash and is the one that decides what it allows.
 */
export interface Identity {
  seat: Seat;
  token: string;
  name: string;
}

const key = (roomId: string) => `debait.seat.${roomId}`;
const NAME_KEY = "debait.name";
const listeners = new Set<() => void>();

// useSyncExternalStore needs the same object for the same stored text.
const cache = new Map<string, { raw: string | null; value: Identity | null }>();

function read(roomId: string): Identity | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key(roomId));
  } catch {
    // Storage unavailable: this browser can only watch.
  }
  const cached = cache.get(roomId);
  if (cached && cached.raw === raw) return cached.value;
  let value: Identity | null = null;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<Identity>;
      if ((parsed.seat === "a" || parsed.seat === "b") && typeof parsed.token === "string") {
        value = { seat: parsed.seat, token: parsed.token, name: typeof parsed.name === "string" ? parsed.name : "" };
      }
    } catch {
      // Corrupted entry: treat as no seat.
    }
  }
  cache.set(roomId, { raw, value });
  return value;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function useIdentity(roomId: string): [Identity | null, (identity: Identity | null) => void] {
  const identity = useSyncExternalStore(
    subscribe,
    () => read(roomId),
    () => null,
  );
  const setIdentity = useCallback(
    (next: Identity | null) => {
      try {
        if (next) {
          localStorage.setItem(key(roomId), JSON.stringify(next));
          localStorage.setItem(NAME_KEY, next.name);
        } else {
          localStorage.removeItem(key(roomId));
        }
      } catch {
        // Not persisted; nothing else to do.
      }
      listeners.forEach((listener) => listener());
    },
    [roomId],
  );
  return [identity, setIdentity];
}

/** The name used the last time this browser joined a debate. */
export function lastName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}
