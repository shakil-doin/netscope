"use client";

import { memo } from "react";
import {
  formatDuration,
  formatBytes,
  formatTimestamp,
  statusBgColor,
  methodColor,
  cn,
} from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { RequestEntry } from "@/types";

interface RequestRowProps {
  req: RequestEntry;
  isSelected: boolean;
  onClick: () => void;
  sessionStart: number;
}

export const RequestRow = memo(function RequestRow({
  req,
  isSelected,
  onClick,
  sessionStart,
}: RequestRowProps) {
  const elapsed = req.requestTime - sessionStart;

  return (
    <tr
      onClick={onClick}
      className={cn(
        "text-xs cursor-pointer border-b border-zinc-800/50 hover:bg-zinc-800/40 transition-colors",
        isSelected && "bg-zinc-800/60",
      )}
    >
      {/* Method */}
      <td
        className={cn(
          "pl-3 pr-2 py-2 font-mono font-semibold",
          methodColor(req.method),
        )}
      >
        {req.method}
      </td>
      {/* Status */}
      <td className="px-2 py-2">
        <span
          className={cn(
            "px-1.5 py-0.5 rounded text-[11px] font-mono",
            statusBgColor(req.statusCode),
          )}
        >
          {(req.statusCode ?? req.status === "pending")
            ? (req.statusCode ?? "…")
            : "—"}
        </span>
      </td>
      {/* URL */}
      <td className="px-2 py-2 max-w-[240px]">
        <span
          className="block truncate text-zinc-300 font-mono"
          title={req.url}
        >
          {req.url.replace(/^https?:\/\/[^/]+/, "")}
        </span>
        <span className="text-zinc-600 text-[10px] truncate block">
          {req.url}
        </span>
      </td>
      {/* Type */}
      <td className="px-2 py-2 text-zinc-500">{req.type.toUpperCase()}</td>
      {/* Route */}
      <td className="px-2 py-2 text-zinc-500 max-w-[80px]">
        <span className="truncate block" title={req.route}>
          {req.route}
        </span>
      </td>
      {/* Duration */}
      <td className="px-2 py-2 text-right font-mono">
        {req.status === "pending" ? (
          <span className="text-blue-400 animate-pulse">…</span>
        ) : (
          <span
            className={cn(
              req.duration && req.duration > 2000
                ? "text-red-400"
                : req.duration && req.duration > 800
                  ? "text-yellow-400"
                  : "text-zinc-300",
            )}
          >
            {formatDuration(req.duration)}
          </span>
        )}
      </td>
      {/* Size */}
      <td className="px-2 py-2 pr-3 text-right font-mono text-zinc-400">
        {formatBytes(req.size)}
      </td>
      {/* Time */}
      <td className="px-2 py-2 pr-3 text-right font-mono text-zinc-600 text-[11px]">
        +{formatDuration(elapsed)}
      </td>
    </tr>
  );
});
