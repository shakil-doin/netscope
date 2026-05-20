"use client";

import { useCallback } from "react";

const SESSION_KEY_PREFIX = "netscope_";

export function useSessionStorage() {
  const get = useCallback(<T>(key: string): T | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = sessionStorage.getItem(SESSION_KEY_PREFIX + key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }, []);

  const set = useCallback(<T>(key: string, value: T) => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem(SESSION_KEY_PREFIX + key, JSON.stringify(value));
    } catch {
      // quota exceeded – ignore
    }
  }, []);

  const remove = useCallback((key: string) => {
    if (typeof window === "undefined") return;
    sessionStorage.removeItem(SESSION_KEY_PREFIX + key);
  }, []);

  const clear = useCallback(() => {
    if (typeof window === "undefined") return;
    const keys = Object.keys(sessionStorage).filter((k) =>
      k.startsWith(SESSION_KEY_PREFIX),
    );
    keys.forEach((k) => sessionStorage.removeItem(k));
  }, []);

  return { get, set, remove, clear };
}
