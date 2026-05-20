"use client";

import { useCallback } from "react";
import { useNetScopeStore } from "@/store/useNetScopeStore";
import type { RouteEntry } from "@/types";

export function useRouteTracker() {
  // Read actions once — they are stable Zustand references.
  // Do NOT subscribe to session here; read it inside the callback via getState()
  // so this hook never triggers re-renders on its own.
  const setCurrentRoute = useNetScopeStore((s) => s.setCurrentRoute);
  const upsertRoute = useNetScopeStore((s) => s.upsertRoute);

  const trackRouteChange = useCallback(
    (path: string) => {
      // Read latest state synchronously — avoids stale closures entirely
      const session = useNetScopeStore.getState().session;
      if (!session) return;
      // No-op if we're already on this path — prevents closing the current
      // RouteEntry when handleLoad fires with the same path it was opened with.
      if (path === session.currentRoute) return;
      const now = Date.now();

      // Close previous route
      const prev = session.routes.find((r) => r.path === session.currentRoute);
      if (prev) {
        upsertRoute({ ...prev, leaveAt: now });
      }

      setCurrentRoute(path);

      // Open new route entry (or update existing)
      const existing = session.routes.find((r) => r.path === path);
      const reqsForRoute = session.requests.filter((r) => r.route === path);
      const failed = reqsForRoute.filter((r) => r.status === "error").length;
      const durations = reqsForRoute
        .map((r) => r.duration)
        .filter((d): d is number => d !== null);
      const avg = durations.length
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0;

      if (!existing) {
        const entry: RouteEntry = {
          path,
          visitedAt: now,
          leaveAt: null,
          apiCallCount: reqsForRoute.length,
          failedCount: failed,
          avgResponseTime: avg,
          totalLoadTime: null,
        };
        upsertRoute(entry);
      }
    },
    // setCurrentRoute and upsertRoute are stable Zustand actions — no session dep
    [setCurrentRoute, upsertRoute],
  );

  return { trackRouteChange };
}
