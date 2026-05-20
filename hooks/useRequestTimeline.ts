"use client";

import { useMemo } from "react";
import { useNetScopeStore } from "@/store/useNetScopeStore";
import type { RequestEntry } from "@/types";

export function useRequestTimeline() {
  const session = useNetScopeStore((s) => s.session);
  const requests = session?.requests ?? [];
  const startTime = session?.startTime ?? Date.now();

  const timeline = useMemo(() => {
    if (!requests.length) return [];
    const sorted = [...requests].sort((a, b) => a.requestTime - b.requestTime);
    const earliest = sorted[0].requestTime;
    const latest = Math.max(
      ...sorted.map((r) =>
        r.responseTime ? r.responseTime : r.requestTime + (r.duration ?? 0),
      ),
    );
    const totalSpan = Math.max(latest - earliest, 1);

    return sorted.map((req) => {
      const left = ((req.requestTime - earliest) / totalSpan) * 100;
      const width = req.duration ? (req.duration / totalSpan) * 100 : 1;
      return {
        ...req,
        left: Math.min(left, 99),
        width: Math.max(Math.min(width, 100 - left), 0.5),
        relativeStart: req.requestTime - startTime,
      };
    });
  }, [requests, startTime]);

  return timeline;
}

export type TimelineEntry = ReturnType<typeof useRequestTimeline>[number];
