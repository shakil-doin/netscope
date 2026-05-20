"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useNetScopeStore } from "@/store/useNetScopeStore";
import { useNetworkTracker } from "@/hooks/useNetworkTracker";
import { usePerformanceMetrics } from "@/hooks/usePerformanceMetrics";
import { SimulatorFrame } from "@/components/simulator/SimulatorFrame";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { isValidUrl } from "@/lib/utils";

function SimulatorInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const url = searchParams.get("url") ?? "";
  const startSession = useNetScopeStore((s) => s.startSession);
  const hydrate = useNetScopeStore((s) => s.hydrate);

  // Resizable split pane
  const [splitPct, setSplitPct] = useState(45);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const onHandlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onHandlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = ((e.clientY - rect.top) / rect.height) * 100;
    setSplitPct(Math.min(Math.max(pct, 15), 80));
  };
  const onHandlePointerUp = () => {
    isDragging.current = false;
  };

  // Always enable tracking when this component is mounted. The url guard
  // below (redirect to "/" if no url) guarantees we're always at /simulator.
  // Patching fetch BEFORE the mount effect means the probe fetch is captured
  // without any timing races.
  useNetworkTracker(!!url);
  usePerformanceMetrics(!!url);

  useEffect(() => {
    hydrate();
    const existingSession = useNetScopeStore.getState().session;
    // Reuse the session ONLY if it is for the same URL and already has
    // captured requests (i.e. the probe fired successfully). Otherwise
    // restart — this prevents an empty/stale session from blocking all future
    // data capture.
    const isUsable =
      existingSession?.targetUrl === url && existingSession.requests.length > 0;
    if (url && isValidUrl(url) && !isUsable) {
      startSession(url);
      // Use mode:'no-cors' so the probe always completes even when the target
      // has no CORS headers. The response is opaque (status 0) but the request
      // entry IS recorded, so the Network tab always shows at least 1 row.
      fetch(url, { mode: "no-cors" }).catch(() => {});
    } else if (!url) {
      router.replace("/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clear session data when tab/browser closes
  useEffect(() => {
    const clearOnUnload = () => sessionStorage.clear();
    window.addEventListener("beforeunload", clearOnUnload);
    return () => window.removeEventListener("beforeunload", clearOnUnload);
  }, []);

  if (!url || !isValidUrl(url)) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950">
      {/* Sidebar */}
      <DashboardSidebar />

      {/* Main content split: simulator + dashboard */}
      <div
        ref={containerRef}
        className="flex flex-col flex-1 min-w-0 overflow-hidden"
      >
        {/* Top: simulator iframe, height controlled by splitPct */}
        <div style={{ height: `${splitPct}%` }} className="shrink-0 min-h-0">
          <SimulatorFrame url={url} />
        </div>

        {/* Drag handle */}
        <div
          className="h-[5px] bg-zinc-800 hover:bg-blue-500 active:bg-blue-500 cursor-row-resize shrink-0 transition-colors select-none"
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerUp}
          title="Drag to resize"
        />

        {/* Bottom: dashboard */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          <DashboardContent />
        </div>
      </div>
    </div>
  );
}

export default function SimulatorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen bg-zinc-950 text-zinc-400 text-sm">
          Loading simulator…
        </div>
      }
    >
      <SimulatorInner />
    </Suspense>
  );
}
