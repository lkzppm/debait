"use client";

import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "debait.theme";

/**
 * Runs in <head> before the first paint, so the page never flashes the wrong
 * theme: the stored choice, or the system's preference the first time.
 */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("${STORAGE_KEY}");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.documentElement.classList.toggle("dark",t==="dark")}catch(e){}`;

// The `dark` class on <html> is the source of truth: the script above sets it,
// the stylesheet and the cubes shader read it, and this store mirrors it.
const listeners = new Set<() => void>();

function readTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setTheme(next: Theme) {
  document.documentElement.classList.toggle("dark", next === "dark");
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Not persisted; the choice still holds for this page.
  }
  listeners.forEach((listener) => listener());
}

/** The current theme. The server renders dark; the browser corrects it on hydration. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, readTheme, () => "dark");
}
