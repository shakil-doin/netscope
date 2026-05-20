"use client";

import { useMemo } from "react";
import { Globe, TrendingUp, AlertCircle, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNetScopeStore } from "@/store/useNetScopeStore";
import { formatDuration, scoreColor, calcRouteScore } from "@/lib/utils";
import type { RequestEntry, RouteEntry } from "@/types";

// Stable empty arrays — selectors never return a new [] reference unnecessarily
const EMPTY_REQUESTS: RequestEntry[] = [];
const EMPTY_ROUTES: RouteEntry[] = [];

export function RouteAnalyticsTab() {
  const requests = useNetScopeStore(
    (s) => s.session?.requests ?? EMPTY_REQUESTS,
  );
  const routes = useNetScopeStore((s) => s.session?.routes ?? EMPTY_ROUTES);

  const routeStats = useMemo(() => {
    return routes
      .map((route) => {
        const routeRequests = requests.filter((r) => r.route === route.path);
        const failed = routeRequests.filter((r) => r.status === "error");
        const completed = routeRequests.filter((r) => r.duration !== null);
        const totalDuration = completed.reduce(
          (a, r) => a + (r.duration ?? 0),
          0,
        );
        const avgDuration = completed.length
          ? totalDuration / completed.length
          : 0;
        const failRate = routeRequests.length
          ? failed.length / routeRequests.length
          : 0;
        const score = calcRouteScore(avgDuration, failRate);
        const timeOnPage =
          route.leaveAt && route.visitedAt
            ? route.leaveAt - route.visitedAt
            : null;

        return {
          path: route.path,
          visitedAt: route.visitedAt,
          totalRequests: routeRequests.length,
          failedRequests: failed.length,
          avgDuration,
          totalDuration,
          failRate,
          score,
          timeOnPage,
          requests: routeRequests,
        };
      })
      .sort((a, b) => b.totalRequests - a.totalRequests);
  }, [requests, routes]);

  if (routeStats.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-600 text-sm flex-col gap-2 p-6">
        <Globe className="h-8 w-8 opacity-30" />
        <p>
          No routes recorded yet. Navigate pages in the simulator to see
          analytics.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 overflow-auto h-full">
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-zinc-500 mb-1">Pages Visited</p>
            <p className="text-2xl font-bold text-zinc-100">
              {routeStats.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-zinc-500 mb-1">Total API Calls</p>
            <p className="text-2xl font-bold text-zinc-100">
              {requests.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-zinc-500 mb-1">Total Errors</p>
            <p className="text-2xl font-bold text-red-400">
              {requests.filter((r) => r.status === "error").length}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        {routeStats.map((stat) => (
          <Card
            key={stat.path}
            className="hover:border-zinc-700 transition-colors"
          >
            <CardContent className="p-4">
              {/* Route header */}
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Globe className="h-4 w-4 text-blue-400 shrink-0" />
                  <span className="font-mono text-sm text-zinc-100 truncate">
                    {stat.path}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-lg font-bold font-mono ${scoreColor(stat.score)}`}
                  >
                    {stat.score}
                  </span>
                  <span className="text-xs text-zinc-600">/100</span>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatItem
                  icon={<TrendingUp className="h-3.5 w-3.5 text-blue-400" />}
                  label="API Calls"
                  value={String(stat.totalRequests)}
                />
                <StatItem
                  icon={<AlertCircle className="h-3.5 w-3.5 text-red-400" />}
                  label="Failed"
                  value={String(stat.failedRequests)}
                  valueClass={
                    stat.failedRequests > 0 ? "text-red-400" : "text-zinc-300"
                  }
                />
                <StatItem
                  icon={<Clock className="h-3.5 w-3.5 text-yellow-400" />}
                  label="Avg API Time"
                  value={formatDuration(stat.avgDuration)}
                />
                <StatItem
                  icon={<Clock className="h-3.5 w-3.5 text-zinc-500" />}
                  label="Time on Page"
                  value={
                    stat.timeOnPage ? formatDuration(stat.timeOnPage) : "—"
                  }
                />
              </div>

              {/* Method breakdown */}
              {stat.requests.length > 0 && (
                <div className="flex gap-1 mt-3 flex-wrap">
                  {(["GET", "POST", "PUT", "PATCH", "DELETE"] as const).map(
                    (method) => {
                      const count = stat.requests.filter(
                        (r) => r.method === method,
                      ).length;
                      if (!count) return null;
                      return (
                        <Badge
                          key={method}
                          variant="secondary"
                          className="text-[10px] font-mono"
                        >
                          {method} {count}
                        </Badge>
                      );
                    },
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function StatItem({
  icon,
  label,
  value,
  valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[11px] text-zinc-500">{label}</span>
      </div>
      <span
        className={`text-sm font-mono font-medium ${valueClass ?? "text-zinc-300"}`}
      >
        {value}
      </span>
    </div>
  );
}
