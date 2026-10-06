"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** `https://host` of the page, or "" while rendering on the server. */
export function useOrigin(): string {
  return useSyncExternalStore(
    subscribe,
    () => window.location.origin,
    () => "",
  );
}
