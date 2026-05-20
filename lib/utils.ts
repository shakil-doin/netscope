// Shared utility functions

// ─── ID ──────────────────────────────────────────────────────────────────────

export function nanoid(): string {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

// ─── Formatting ───────────────────────────────────────────────────────────────

export function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
}

export function formatRelativeTime(ts: number, base: number): string {
  const diff = ts - base;
  return `+${formatDuration(diff)}`;
}

// ─── URL ──────────────────────────────────────────────────────────────────────

export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeUrl(url: string): string {
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return `https://${url}`;
  }
  return url;
}

export function getPathname(url: string): string {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return "/";
  }
}

export function truncateUrl(url: string, maxLen = 60): string {
  if (url.length <= maxLen) return url;
  return url.slice(0, maxLen - 3) + "…";
}

// ─── Status ───────────────────────────────────────────────────────────────────

export function statusColor(code: number | null): string {
  if (code === null) return "text-zinc-400";
  if (code < 300) return "text-emerald-400";
  if (code < 400) return "text-yellow-400";
  if (code < 500) return "text-orange-400";
  return "text-red-400";
}

export function statusBgColor(code: number | null): string {
  if (code === null) return "bg-zinc-800 text-zinc-300";
  if (code < 300) return "bg-emerald-950 text-emerald-400";
  if (code < 400) return "bg-yellow-950 text-yellow-400";
  if (code < 500) return "bg-orange-950 text-orange-400";
  return "bg-red-950 text-red-400";
}

export function methodColor(method: string): string {
  const map: Record<string, string> = {
    GET: "text-blue-400",
    POST: "text-green-400",
    PUT: "text-yellow-400",
    PATCH: "text-orange-400",
    DELETE: "text-red-400",
    OPTIONS: "text-purple-400",
    HEAD: "text-zinc-400",
  };
  return map[method] ?? "text-zinc-400";
}

// ─── Performance score ────────────────────────────────────────────────────────

export function scoreColor(score: number): string {
  if (score >= 90) return "text-emerald-400";
  if (score >= 50) return "text-yellow-400";
  return "text-red-400";
}

export function calcRouteScore(avgMs: number, failRate: number): number {
  let score = 100;
  if (avgMs > 3000) score -= 40;
  else if (avgMs > 1000) score -= 20;
  else if (avgMs > 500) score -= 10;
  score -= failRate * 50;
  return Math.max(0, Math.round(score));
}

// ─── Debounce ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number,
): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  }) as T;
}

// ─── cn (Tailwind class merger) ───────────────────────────────────────────────

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
