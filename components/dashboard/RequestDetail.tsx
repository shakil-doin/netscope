"use client";

import { X, Copy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  formatDuration,
  formatBytes,
  formatTimestamp,
  methodColor,
  statusBgColor,
  cn,
} from "@/lib/utils";
import type { RequestEntry } from "@/types";

interface RequestDetailProps {
  req: RequestEntry;
  onClose: () => void;
}

export function RequestDetail({ req, onClose }: RequestDetailProps) {
  const [copied, setCopied] = useState(false);

  const copyUrl = () => {
    navigator.clipboard.writeText(req.url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const total = req.duration ?? 0;
  const waitingPct = total > 0 ? (req.phase.waiting / total) * 100 : 0;
  const receivingPct = total > 0 ? (req.phase.receiving / total) * 100 : 0;

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <span className="text-xs font-medium text-zinc-300">
          Request Details
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {/* Status + Method */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                "font-mono font-semibold text-sm",
                methodColor(req.method),
              )}
            >
              {req.method}
            </span>
            <span
              className={cn(
                "px-2 py-0.5 rounded text-xs font-mono",
                statusBgColor(req.statusCode),
              )}
            >
              {req.statusCode ?? (req.status === "pending" ? "Pending" : "—")}
            </span>
            <Badge
              variant={
                req.status === "error"
                  ? "destructive"
                  : req.status === "pending"
                    ? "secondary"
                    : "success"
              }
            >
              {req.status}
            </Badge>
            <Badge variant="secondary">{req.type.toUpperCase()}</Badge>
          </div>

          {/* URL */}
          <div>
            <p className="text-[11px] text-zinc-500 mb-1 uppercase tracking-wider">
              URL
            </p>
            <div className="flex items-start gap-2">
              <p className="text-xs text-zinc-300 font-mono break-all flex-1">
                {req.url}
              </p>
              <button onClick={copyUrl} className="shrink-0 mt-0.5">
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-zinc-500 hover:text-zinc-300" />
                )}
              </button>
            </div>
          </div>

          {/* Timing */}
          <div>
            <p className="text-[11px] text-zinc-500 mb-2 uppercase tracking-wider">
              Timing
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              <MetricRow
                label="Duration"
                value={formatDuration(req.duration)}
              />
              <MetricRow label="Size" value={formatBytes(req.size)} />
              <MetricRow
                label="Started"
                value={formatTimestamp(req.requestTime)}
              />
              {req.responseTime && (
                <MetricRow
                  label="Ended"
                  value={formatTimestamp(req.responseTime)}
                />
              )}
              <MetricRow label="Route" value={req.route} />
              <MetricRow label="Initiator" value={req.initiator} />
            </div>
          </div>

          {/* Phase waterfall */}
          {req.duration && req.duration > 0 && (
            <div>
              <p className="text-[11px] text-zinc-500 mb-2 uppercase tracking-wider">
                Phase Breakdown
              </p>
              <div className="space-y-2">
                <Phase
                  label="Waiting"
                  pct={waitingPct}
                  duration={req.phase.waiting}
                  color="bg-blue-500"
                />
                <Phase
                  label="Receiving"
                  pct={receivingPct}
                  duration={req.phase.receiving}
                  color="bg-emerald-500"
                />
              </div>
            </div>
          )}

          {/* Error */}
          {req.error && (
            <div className="rounded border border-red-900 bg-red-950/40 p-3">
              <p className="text-[11px] text-red-400 uppercase tracking-wider mb-1">
                Error
              </p>
              <p className="text-xs text-red-300 font-mono break-all">
                {req.error}
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="text-[11px] text-zinc-500">{label}</span>
      <span className="text-[11px] text-zinc-300 font-mono">{value}</span>
    </>
  );
}

function Phase({
  label,
  pct,
  duration,
  color,
}: {
  label: string;
  pct: number;
  duration: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-[11px] mb-1">
        <span className="text-zinc-500">{label}</span>
        <span className="text-zinc-400 font-mono">
          {formatDuration(duration)}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-zinc-800">
        <div
          className={cn("h-full rounded-full", color)}
          style={{ width: `${Math.max(pct, 1)}%` }}
        />
      </div>
    </div>
  );
}
