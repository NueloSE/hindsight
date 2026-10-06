"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * localStorage as an external store: hydration-safe (the server snapshot is null) and in sync across
 * components and tabs. Every access is guarded because storage can be unavailable.
 */
const EVENT = "hindsight:storage";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // storage unavailable: the change won't persist
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Raw stored string for `key` (null on the server and when absent). */
export function useStored(key: string): [string | null, (value: string | null) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
  const set = useCallback((v: string | null) => writeStored(key, v), [key]);
  return [value, set];
}

const noop = () => () => {};

/** False during server render and hydration, true afterwards. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
