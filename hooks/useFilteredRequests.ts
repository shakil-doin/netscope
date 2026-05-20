"use client";

import { useMemo, useState, useCallback } from "react";
import { useNetScopeStore } from "@/store/useNetScopeStore";
import { debounce } from "@/lib/utils";
import type { RequestEntry } from "@/types";

// Stable fallback so the selector never returns a new [] reference
const EMPTY_REQUESTS: RequestEntry[] = [];

export function useFilteredRequests() {
  const requests = useNetScopeStore(
    (s) => s.session?.requests ?? EMPTY_REQUESTS,
  );
  const filters = useNetScopeStore((s) => s.filters);
  const setFilters = useNetScopeStore((s) => s.setFilters);

  const [localSearch, setLocalSearch] = useState(filters.search);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSearch = useCallback(
    debounce((val: string) => setFilters({ search: val }), 200),
    [setFilters],
  );

  const handleSearch = (val: string) => {
    setLocalSearch(val);
    debouncedSearch(val);
  };

  const filtered = useMemo<RequestEntry[]>(() => {
    let result = [...requests];

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (r) =>
          r.url.toLowerCase().includes(q) || r.method.toLowerCase().includes(q),
      );
    }
    if (filters.method !== "all") {
      result = result.filter((r) => r.method === filters.method);
    }
    if (filters.status !== "all") {
      result = result.filter((r) => r.status === filters.status);
    }
    if (filters.type !== "all") {
      result = result.filter((r) => r.type === filters.type);
    }
    if (filters.route !== "all") {
      result = result.filter((r) => r.route === filters.route);
    }

    result.sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;
      switch (filters.sortBy) {
        case "time":
          aVal = a.requestTime;
          bVal = b.requestTime;
          break;
        case "duration":
          aVal = a.duration ?? -1;
          bVal = b.duration ?? -1;
          break;
        case "size":
          aVal = a.size ?? -1;
          bVal = b.size ?? -1;
          break;
        case "status":
          aVal = a.statusCode ?? -1;
          bVal = b.statusCode ?? -1;
          break;
        case "method":
          aVal = a.method;
          bVal = b.method;
          break;
      }
      if (typeof aVal === "string") {
        return filters.sortDir === "asc"
          ? aVal.localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal);
      }
      return filters.sortDir === "asc"
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });

    return result;
  }, [requests, filters]);

  return { filtered, localSearch, handleSearch };
}
