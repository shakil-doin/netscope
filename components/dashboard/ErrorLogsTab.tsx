"use client";

import { AlertTriangle, AlertCircle, Zap, X, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useNetScopeStore } from "@/store/useNetScopeStore";
import { formatTimestamp } from "@/lib/utils";
import type { ErrorEntry, ErrorType } from "@/types";

// Stable empty array — selector never returns a new [] reference unnecessarily
const EMPTY_ERRORS: ErrorEntry[] = [];

const ERROR_ICONS: Record<ErrorType, React.ReactNode> = {
  uncaught: <AlertCircle className="h-3.5 w-3.5 text-red-400" />,
  "unhandled-rejection": (
    <AlertTriangle className="h-3.5 w-3.5 text-orange-400" />
  ),
  network: <Zap className="h-3.5 w-3.5 text-yellow-400" />,
  cors: <Shield className="h-3.5 w-3.5 text-purple-400" />,
  timeout: <AlertCircle className="h-3.5 w-3.5 text-red-400" />,
};

const ERROR_BADGE: Record<ErrorType, "destructive" | "warning" | "secondary"> =
  {
    uncaught: "destructive",
    "unhandled-rejection": "warning",
    network: "warning",
    cors: "secondary",
    timeout: "destructive",
  };

export function ErrorLogsTab() {
  const errors = useNetScopeStore((s) => s.session?.errors ?? EMPTY_ERRORS);

  const exportErrors = () => {
    const blob = new Blob([JSON.stringify(errors, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `netscope-errors-${Date.now()}.json`;
    a.click();
  };

  if (errors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-600">
        <Shield className="h-10 w-10 opacity-30" />
        <p className="text-sm">No errors detected. Looking good!</p>
      </div>
    );
  }

  const byType = errors.reduce<Record<string, number>>((acc, e) => {
    acc[e.type] = (acc[e.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
        <span className="text-sm font-medium text-zinc-300">
          {errors.length} errors captured
        </span>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(byType).map(([type, count]) => (
            <Badge
              key={type}
              variant={ERROR_BADGE[type as ErrorType] ?? "secondary"}
              className="text-[10px]"
            >
              {type} ({count})
            </Badge>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto h-7 text-xs"
          onClick={exportErrors}
        >
          Export JSON
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {[...errors].reverse().map((err) => (
            <ErrorCard key={err.id} err={err} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function ErrorCard({ err }: { err: ErrorEntry }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 hover:border-zinc-700 transition-colors">
      <div className="flex items-start gap-2 mb-2">
        <div className="mt-0.5">{ERROR_ICONS[err.type]}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge
              variant={ERROR_BADGE[err.type] ?? "secondary"}
              className="text-[10px]"
            >
              {err.type}
            </Badge>
            <span className="text-[11px] text-zinc-500 font-mono">
              {formatTimestamp(err.timestamp)}
            </span>
            <span className="text-[11px] text-zinc-600 font-mono">
              {err.route}
            </span>
          </div>
          <p className="text-xs text-zinc-200 break-all">{err.message}</p>
          {err.url && (
            <p className="text-[11px] text-zinc-500 font-mono mt-1 truncate">
              {err.url}
            </p>
          )}
        </div>
      </div>
      {err.stack && (
        <pre className="text-[10px] text-zinc-600 font-mono bg-zinc-950 rounded p-2 overflow-x-auto max-h-24 mt-2">
          {err.stack}
        </pre>
      )}
    </div>
  );
}
