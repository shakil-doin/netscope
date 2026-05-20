"use client";

import { lazy, Suspense } from "react";
import { Activity, Zap, AlertTriangle, Clock, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useNetScopeStore } from "@/store/useNetScopeStore";
import { formatDuration, formatBytes, scoreColor } from "@/lib/utils";

const PerformanceChart = lazy(() =>
  import("./PerformanceChart").then((m) => ({ default: m.PerformanceChart })),
);

function Metric({
  label,
  value,
  unit,
  good,
  warn,
}: {
  label: string;
  value: number | null;
  unit?: string;
  good?: number;
  warn?: number;
}) {
  const color =
    value === null
      ? "text-zinc-600"
      : good && value <= good
        ? "text-emerald-400"
        : warn && value <= warn
          ? "text-yellow-400"
          : "text-red-400";

  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-zinc-500 mb-1">{label}</p>
        <p className={`text-2xl font-bold font-mono ${color}`}>
          {value === null
            ? "—"
            : `${typeof value === "number" ? value.toFixed(0) : value}${unit ?? ""}`}
        </p>
        {good && value !== null && (
          <p className="text-[11px] mt-1 text-zinc-600">
            {value <= good
              ? "✓ Good"
              : value <= (warn ?? good * 2)
                ? "⚠ Needs improvement"
                : "✗ Poor"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function PerformanceTab() {
  const session = useNetScopeStore((s) => s.session);
  const perf = session?.performance ?? null;
  const resources = session?.resources ?? [];

  const jsSize = perf?.jsSize ?? 0;
  const cssSize = perf?.cssSize ?? 0;
  const imgSize = perf?.imageSize ?? 0;
  const totalSize = perf?.totalSize ?? 1;

  // Resource breakdown pie data (using bar instead)
  const sizeItems = [
    { label: "JavaScript", size: jsSize, color: "bg-yellow-500" },
    { label: "CSS", size: cssSize, color: "bg-blue-500" },
    { label: "Images", size: imgSize, color: "bg-purple-500" },
    {
      label: "Other",
      size: Math.max(0, totalSize - jsSize - cssSize - imgSize),
      color: "bg-zinc-600",
    },
  ];

  const slowResources = [...resources]
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 8);

  return (
    <div className="p-4 space-y-6 overflow-auto h-full">
      {/* Web Vitals */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
          <Zap className="h-4 w-4 text-blue-400" /> Core Web Vitals
        </h2>
        {!perf && (
          <div className="rounded border border-zinc-800 bg-zinc-900/50 px-4 py-6 text-center text-sm text-zinc-500 flex items-center justify-center gap-2">
            <Info className="h-4 w-4" /> Performance data will appear after a
            page loads in the simulator.
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Metric
            label="TTFB"
            value={perf?.ttfb ?? null}
            unit="ms"
            good={200}
            warn={800}
          />
          <Metric
            label="FCP"
            value={perf?.fcp ?? null}
            unit="ms"
            good={1800}
            warn={3000}
          />
          <Metric
            label="LCP"
            value={perf?.lcp ?? null}
            unit="ms"
            good={2500}
            warn={4000}
          />
          <Metric
            label="CLS"
            value={
              perf?.cls !== null && perf?.cls !== undefined
                ? +(perf.cls * 1000).toFixed(0)
                : null
            }
            unit=""
            good={100}
            warn={250}
          />
          <Metric
            label="INP"
            value={perf?.inp ?? null}
            unit="ms"
            good={200}
            warn={500}
          />
        </div>
      </section>

      {/* Load timing */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-400" /> Load Timing
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Metric
            label="DOM Content Loaded"
            value={perf?.domContentLoaded ?? null}
            unit="ms"
            good={1500}
            warn={3000}
          />
          <Metric
            label="Load Complete"
            value={perf?.loadComplete ?? null}
            unit="ms"
            good={3000}
            warn={6000}
          />
          <Metric
            label="Resources"
            value={perf?.resourceCount ?? null}
            unit=""
          />
        </div>
      </section>

      {/* Resource size breakdown */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-blue-400" /> Resource Size Breakdown
        </h2>
        <Card>
          <CardContent className="p-4 space-y-3">
            {sizeItems.map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-400">{item.label}</span>
                  <span className="text-zinc-300 font-mono">
                    {formatBytes(item.size)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-zinc-800">
                  <div
                    className={`h-full rounded-full ${item.color}`}
                    style={{
                      width: `${totalSize > 0 ? (item.size / totalSize) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
            <div className="flex justify-between text-xs pt-1 border-t border-zinc-800">
              <span className="text-zinc-500">Total</span>
              <span className="text-zinc-200 font-mono">
                {formatBytes(totalSize)}
              </span>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Slow resources */}
      {slowResources.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-400" /> Slowest
            Resources
          </h2>
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left px-4 py-2 text-zinc-500 font-medium">
                      Resource
                    </th>
                    <th className="text-right px-4 py-2 text-zinc-500 font-medium">
                      Size
                    </th>
                    <th className="text-right px-4 py-2 text-zinc-500 font-medium">
                      Duration
                    </th>
                    <th className="text-right px-4 py-2 text-zinc-500 font-medium">
                      Type
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {slowResources.map((r, i) => {
                    const name =
                      r.name.split("/").pop()?.split("?")[0] ?? r.name;
                    return (
                      <tr
                        key={i}
                        className="border-b border-zinc-800/50 hover:bg-zinc-800/30"
                      >
                        <td
                          className="px-4 py-2 text-zinc-300 font-mono truncate max-w-[220px]"
                          title={r.name}
                        >
                          {name}
                        </td>
                        <td className="px-4 py-2 text-right text-zinc-400 font-mono">
                          {formatBytes(r.size)}
                        </td>
                        <td className="px-4 py-2 text-right font-mono">
                          <span
                            className={
                              r.duration > 1000
                                ? "text-red-400"
                                : r.duration > 500
                                  ? "text-yellow-400"
                                  : "text-zinc-300"
                            }
                          >
                            {formatDuration(r.duration)}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right text-zinc-500">
                          {r.type}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Chart */}
      {session?.requests && session.requests.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-400" /> API Response Times
          </h2>
          <Card>
            <CardContent className="p-4 h-48">
              <Suspense
                fallback={
                  <div className="flex items-center justify-center h-full text-zinc-600 text-xs">
                    Loading chart…
                  </div>
                }
              >
                <PerformanceChart requests={session.requests} />
              </Suspense>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
