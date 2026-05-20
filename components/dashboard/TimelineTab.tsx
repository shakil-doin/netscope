"use client";

import { useRequestTimeline } from "@/hooks/useRequestTimeline";
import { useNetScopeStore } from "@/store/useNetScopeStore";
import {
  formatDuration,
  formatRelativeTime,
  methodColor,
  statusBgColor,
  cn,
} from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const BAR_COLORS: Record<string, string> = {
  success: "bg-blue-500 hover:bg-blue-400",
  error: "bg-red-500 hover:bg-red-400",
  pending: "bg-zinc-500 animate-pulse",
  timeout: "bg-orange-500",
  aborted: "bg-zinc-700",
};

export function TimelineTab() {
  const timeline = useRequestTimeline();
  const sessionStart = useNetScopeStore((s) => s.session?.startTime ?? 0);

  if (timeline.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
        No requests to display in the timeline yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-zinc-800 text-xs text-zinc-500">
        <span className="font-medium text-zinc-400">Waterfall</span>
        <div className="flex items-center gap-1">
          <span className="h-2 w-4 rounded bg-blue-500" /> Success
        </div>
        <div className="flex items-center gap-1">
          <span className="h-2 w-4 rounded bg-red-500" /> Error
        </div>
        <div className="flex items-center gap-1">
          <span className="h-2 w-4 rounded bg-zinc-500" /> Pending
        </div>
        <span className="ml-auto">{timeline.length} requests</span>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-4 py-3 min-w-[600px]">
          {/* Time ruler */}
          <div className="flex mb-2 pl-[260px] pr-2">
            {[0, 25, 50, 75, 100].map((pct) => (
              <div
                key={pct}
                className="flex-1 text-[10px] text-zinc-600 font-mono text-right"
              >
                {pct}%
              </div>
            ))}
          </div>

          <TooltipProvider>
            <div className="space-y-0.5">
              {timeline.map((entry) => {
                const barColor = BAR_COLORS[entry.status] ?? "bg-zinc-500";
                return (
                  <div key={entry.id} className="flex items-center gap-2 group">
                    {/* Left: method + url */}
                    <div className="w-[260px] flex items-center gap-2 shrink-0">
                      <span
                        className={cn(
                          "text-[11px] font-mono font-semibold w-10 shrink-0 text-right",
                          methodColor(entry.method),
                        )}
                      >
                        {entry.method}
                      </span>
                      <span
                        className="text-[11px] text-zinc-400 font-mono truncate flex-1"
                        title={entry.url}
                      >
                        {entry.url
                          .replace(/^https?:\/\/[^/]+/, "")
                          .slice(0, 30) || "/"}
                      </span>
                    </div>

                    {/* Waterfall bar */}
                    <div className="flex-1 relative h-5 bg-zinc-800/40 rounded">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              "absolute top-1 bottom-1 rounded cursor-pointer transition-colors",
                              barColor,
                            )}
                            style={{
                              left: `${entry.left}%`,
                              width: `${entry.width}%`,
                              minWidth: 3,
                            }}
                          />
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs">
                          <div className="space-y-1 text-xs">
                            <p className="font-mono text-zinc-200 break-all">
                              {entry.url}
                            </p>
                            <p>
                              <span className="text-zinc-500">Status: </span>
                              <span
                                className={cn(
                                  "font-mono",
                                  statusBgColor(entry.statusCode),
                                )}
                              >
                                {entry.statusCode ?? entry.status}
                              </span>
                            </p>
                            <p>
                              <span className="text-zinc-500">Duration: </span>
                              {formatDuration(entry.duration)}
                            </p>
                            <p>
                              <span className="text-zinc-500">Start: </span>
                              {formatRelativeTime(
                                entry.requestTime,
                                sessionStart,
                              )}
                            </p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </div>

                    {/* Right: duration */}
                    <div className="text-[11px] font-mono text-zinc-500 w-14 text-right shrink-0">
                      {formatDuration(entry.duration)}
                    </div>
                  </div>
                );
              })}
            </div>
          </TooltipProvider>
        </div>
      </ScrollArea>
    </div>
  );
}
