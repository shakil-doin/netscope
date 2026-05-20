"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { formatDuration } from "@/lib/utils";
import type { RequestEntry } from "@/types";

interface PerformanceChartProps {
  requests: RequestEntry[];
}

export function PerformanceChart({ requests }: PerformanceChartProps) {
  const data = requests
    .filter((r) => r.duration !== null)
    .slice(-30)
    .map((r, i) => ({
      name: i + 1,
      duration: Math.round(r.duration!),
      url: r.url.replace(/^https?:\/\/[^/]+/, "") || "/",
      method: r.method,
      status: r.status,
    }));

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-600 text-xs">
        No completed requests yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#71717a" }} />
        <YAxis
          tick={{ fontSize: 10, fill: "#71717a" }}
          tickFormatter={(v) => `${v}ms`}
        />
        <Tooltip
          contentStyle={{
            background: "#18181b",
            border: "1px solid #3f3f46",
            borderRadius: 6,
            fontSize: 12,
          }}
          labelStyle={{ color: "#a1a1aa" }}
          formatter={(val, _name, props) => [
            formatDuration(typeof val === "number" ? val : null),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (props as any).payload?.url ?? "",
          ]}
        />
        <Bar dataKey="duration" radius={[3, 3, 0, 0]}>
          {data.map((entry, index) => (
            <Cell
              key={index}
              fill={
                entry.status === "error"
                  ? "#ef4444"
                  : entry.duration > 2000
                    ? "#f59e0b"
                    : entry.duration > 800
                      ? "#3b82f6"
                      : "#22c55e"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
