"use client";

import { useState, useRef, useEffect } from "react";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  X,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RequestRow } from "./RequestRow";
import { RequestDetail } from "./RequestDetail";
import { useNetScopeStore } from "@/store/useNetScopeStore";
import { useFilteredRequests } from "@/hooks/useFilteredRequests";
import type { FilterState, RequestEntry } from "@/types";

const COLS = [
  { key: "method", label: "Method", sortable: false },
  { key: "status", label: "Status", sortable: true },
  { key: "url", label: "URL", sortable: false },
  { key: "type", label: "Type", sortable: false },
  { key: "route", label: "Route", sortable: false },
  { key: "duration", label: "Time", sortable: true },
  { key: "size", label: "Size", sortable: true },
  { key: "elapsed", label: "At", sortable: false },
] as const;

// Defined at module level — React never sees a new component type on re-render,
// which prevents unnecessary unmount/remount of table header cells.
function SortIcon({
  col,
  sortBy,
  sortDir,
}: {
  col: string;
  sortBy: FilterState["sortBy"];
  sortDir: FilterState["sortDir"];
}) {
  const active = sortBy === col || (col === "elapsed" && sortBy === "time");
  if (!active) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
  return sortDir === "asc" ? (
    <ArrowUp className="h-3 w-3" />
  ) : (
    <ArrowDown className="h-3 w-3" />
  );
}

export function NetworkTab() {
  const { filtered, localSearch, handleSearch } = useFilteredRequests();

  // Subscribe to primitives only — avoids re-renders on every single request update
  const totalCount = useNetScopeStore((s) => s.session?.requests.length ?? 0);
  const pendingCount = useNetScopeStore(
    (s) =>
      s.session?.requests.filter((r) => r.status === "pending").length ?? 0,
  );
  const errorCount = useNetScopeStore(
    (s) => s.session?.requests.filter((r) => r.status === "error").length ?? 0,
  );
  const sessionStart = useNetScopeStore((s) => s.session?.startTime ?? 0);
  const filters = useNetScopeStore((s) => s.filters);
  const setFilters = useNetScopeStore((s) => s.setFilters);
  const clearFilters = useNetScopeStore((s) => s.clearFilters);

  const [selected, setSelected] = useState<RequestEntry | null>(null);

  // Auto-scroll to bottom when new rows arrive, unless user scrolled up.
  // Use a "programmatic scroll" guard so setting scrollTop doesn't flip
  // pinnedToBottomRef back to false via the onScroll handler.
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedToBottomRef = useRef(true);
  const programmaticScrollRef = useRef(false);

  const handleTableScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (programmaticScrollRef.current) return; // ignore self-triggered scroll
    const el = e.currentTarget;
    pinnedToBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  useEffect(() => {
    if (pinnedToBottomRef.current && scrollRef.current) {
      programmaticScrollRef.current = true;
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      // Reset the guard after the browser's scroll event fires
      requestAnimationFrame(() => {
        programmaticScrollRef.current = false;
      });
    }
  }, [filtered.length]);

  const handleSort = (col: string) => {
    const validSortKeys = ["duration", "size", "status", "method"] as const;
    type SortKey = (typeof validSortKeys)[number] | "time";
    const sortKey = col === "elapsed" ? "time" : (col as SortKey);
    if (
      !validSortKeys.includes(col as (typeof validSortKeys)[number]) &&
      col !== "elapsed"
    )
      return;
    if (filters.sortBy === sortKey) {
      setFilters({ sortDir: filters.sortDir === "asc" ? "desc" : "asc" });
    } else {
      setFilters({ sortBy: sortKey, sortDir: "desc" });
    }
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `netscope-network-${Date.now()}.json`;
    a.click();
  };

  return (
    <div className="flex h-full">
      {/* Main table */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800 flex-wrap">
          {/* Stats */}
          <div className="flex items-center gap-3 text-xs text-zinc-500 mr-2">
            <span>
              <span className="text-zinc-100 font-medium">{totalCount}</span>{" "}
              total
            </span>
            {pendingCount > 0 && (
              <span className="text-blue-400 animate-pulse">
                {pendingCount} pending
              </span>
            )}
            {errorCount > 0 && (
              <span className="text-red-400">{errorCount} failed</span>
            )}
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-500" />
            <Input
              className="h-7 pl-7 text-xs"
              placeholder="Filter URL or method…"
              value={localSearch}
              onChange={(e) => handleSearch(e.target.value)}
            />
            {localSearch && (
              <button
                onClick={() => handleSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2"
              >
                <X className="h-3 w-3 text-zinc-500 hover:text-zinc-300" />
              </button>
            )}
          </div>

          {/* Method filter */}
          <Select
            value={filters.method}
            onValueChange={(v) => setFilters({ method: v })}
          >
            <SelectTrigger className="h-7 w-24 text-xs">
              <SelectValue placeholder="Method" />
            </SelectTrigger>
            <SelectContent>
              {["all", "GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                <SelectItem key={m} value={m}>
                  {m === "all" ? "All methods" : m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status filter */}
          <Select
            value={filters.status}
            onValueChange={(v) => setFilters({ status: v })}
          >
            <SelectTrigger className="h-7 w-24 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {[
                { value: "all", label: "All status" },
                { value: "success", label: "Success" },
                { value: "error", label: "Error" },
                { value: "pending", label: "Pending" },
              ].map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Type filter */}
          <Select
            value={filters.type}
            onValueChange={(v) => setFilters({ type: v })}
          >
            <SelectTrigger className="h-7 w-20 text-xs">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              {["all", "fetch", "xhr", "resource"].map((t) => (
                <SelectItem key={t} value={t}>
                  {t === "all" ? "All types" : t.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="ml-auto flex gap-1">
            {(filters.search ||
              filters.method !== "all" ||
              filters.status !== "all" ||
              filters.type !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={clearFilters}
              >
                <X className="h-3 w-3" /> Clear
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={handleExport}
              title="Export JSON"
            >
              <Download className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Table */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto"
          onScroll={handleTableScroll}
        >
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-zinc-900 border-b border-zinc-800">
              <tr>
                {COLS.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => col.sortable && handleSort(col.key)}
                    className={`px-2 py-2 text-left text-[11px] font-medium text-zinc-500 whitespace-nowrap select-none ${col.sortable ? "cursor-pointer hover:text-zinc-300" : ""} ${col.key === "duration" || col.key === "size" || col.key === "elapsed" ? "text-right" : ""}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {col.sortable && (
                        <SortIcon
                          col={col.key}
                          sortBy={filters.sortBy}
                          sortDir={filters.sortDir}
                        />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="text-center py-16 text-zinc-600 text-sm"
                  >
                    {totalCount === 0
                      ? "No requests captured yet. Load a website to start tracking."
                      : "No requests match your filters."}
                  </td>
                </tr>
              ) : (
                filtered.map((req) => (
                  <RequestRow
                    key={req.id}
                    req={req}
                    isSelected={selected?.id === req.id}
                    onClick={() =>
                      setSelected(selected?.id === req.id ? null : req)
                    }
                    sessionStart={sessionStart}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="w-80 border-l border-zinc-800 flex-shrink-0">
          <RequestDetail req={selected} onClose={() => setSelected(null)} />
        </div>
      )}
    </div>
  );
}
