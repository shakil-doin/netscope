"use client";

import { lazy, Suspense } from "react";
import { useNetScopeStore } from "@/store/useNetScopeStore";
import { NetworkTab } from "./NetworkTab";
import { SidebarToggle } from "./DashboardSidebar";

const PerformanceTab = lazy(() =>
  import("./PerformanceTab").then((m) => ({ default: m.PerformanceTab })),
);
const RouteAnalyticsTab = lazy(() =>
  import("./RouteAnalyticsTab").then((m) => ({ default: m.RouteAnalyticsTab })),
);
const ErrorLogsTab = lazy(() =>
  import("./ErrorLogsTab").then((m) => ({ default: m.ErrorLogsTab })),
);
const TimelineTab = lazy(() =>
  import("./TimelineTab").then((m) => ({ default: m.TimelineTab })),
);

const TAB_LABELS: Record<string, string> = {
  network: "Network",
  performance: "Performance",
  routes: "Route Analytics",
  errors: "Error Logs",
  timeline: "Request Timeline",
};

function TabSkeleton() {
  return (
    <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
      Loading…
    </div>
  );
}

export function DashboardContent() {
  const activeTab = useNetScopeStore((s) => s.activeTab);
  const targetUrl = useNetScopeStore((s) => s.session?.targetUrl ?? "");
  const hasSession = useNetScopeStore((s) => !!s.session);

  return (
    <div className="flex flex-col flex-1 min-w-0 h-full">
      {/* Top bar */}
      <header className="flex items-center gap-3 px-3 py-2 border-b border-zinc-800 bg-zinc-950 shrink-0">
        <SidebarToggle />
        <span className="text-sm font-medium text-zinc-200">
          {TAB_LABELS[activeTab]}
        </span>
        {targetUrl && (
          <span className="text-xs text-zinc-600 font-mono truncate ml-2 hidden sm:block">
            → {targetUrl}
          </span>
        )}
        {hasSession && (
          <div className="ml-auto flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-zinc-500">Live</span>
          </div>
        )}
      </header>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === "network" && <NetworkTab />}
        <Suspense fallback={<TabSkeleton />}>
          {activeTab === "performance" && <PerformanceTab />}
          {activeTab === "routes" && <RouteAnalyticsTab />}
          {activeTab === "errors" && <ErrorLogsTab />}
          {activeTab === "timeline" && <TimelineTab />}
        </Suspense>
      </div>
    </div>
  );
}
