"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { AlertTriangle, ExternalLink, RefreshCw, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNetScopeStore } from "@/store/useNetScopeStore";
import { useRouteTracker } from "@/hooks/useRouteTracker";
import { nanoid } from "@/lib/utils";
import {
  processIframeMessage,
  buildIframeTrackerScript,
} from "@/hooks/usePerformanceMetrics";
import type { RequestEntry, ErrorEntry } from "@/types";

interface SimulatorFrameProps {
  url: string;
}

/**
 * Returns the URL to load in the iframe.
 * Cross-origin targets are routed through /api/proxy so the tracker script
 * can be auto-injected server-side — no user setup required.
 */
function getIframeSrc(target: string): string {
  if (typeof window === "undefined") return target;
  try {
    if (new URL(target).origin !== window.location.origin) {
      return `/api/proxy?url=${encodeURIComponent(target)}`;
    }
  } catch {
    /* invalid URL — let it fall through */
  }
  return target;
}

export function SimulatorFrame({ url }: SimulatorFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  // Ref so handleLoad (stale closure) can read the current proxy state.
  const isProxiedRef = useRef(false);

  // Compute the iframe src only on the client (after mount) to avoid the
  // SSR→hydration mismatch that would cause the iframe to load twice:
  // once with the direct URL (from SSR HTML), once with the proxy URL.
  // Starting with "" means the iframe renders without a src on the server
  // and the real src is set on the first client-side effect.
  const [srcUrl, setSrcUrl] = useState("");
  useEffect(() => {
    const s = getIframeSrc(url);
    isProxiedRef.current = s !== url;
    setSrcUrl(s);
  }, [url]);
  const iframeBlocked = useNetScopeStore((s) => s.iframeBlocked);
  const setIframeBlocked = useNetScopeStore((s) => s.setIframeBlocked);
  const addRequest = useNetScopeStore((s) => s.addRequest);
  const updateRequest = useNetScopeStore((s) => s.updateRequest);
  const addError = useNetScopeStore((s) => s.addError);
  const setPerformance = useNetScopeStore((s) => s.setPerformance);
  const { trackRouteChange } = useRouteTracker();

  // Track currentRoute via a ref — updated by a passive store subscription so
  // SimulatorFrame never re-renders just because a request was added.
  const currentRouteRef = useRef(
    useNetScopeStore.getState().session?.currentRoute ?? "/",
  );
  useEffect(() => {
    return useNetScopeStore.subscribe((state) => {
      currentRouteRef.current = state.session?.currentRoute ?? "/";
    });
  }, []);

  // Pending requests map for the iframe messages
  const pendingRef = useRef<
    Map<string, { entry: RequestEntry; startTime: number }>
  >(new Map());

  const handleIframeMessage = useCallback(
    (event: MessageEvent) => {
      processIframeMessage(event, {
        onRequestStart: (data) => {
          const entry: RequestEntry = {
            id: data.id,
            url: data.url,
            method: data.method as RequestEntry["method"],
            status: "pending",
            statusCode: null,
            requestTime: data.timestamp,
            responseTime: null,
            duration: null,
            size: null,
            route: currentRouteRef.current,
            type: data.reqType === "xhr" ? "xhr" : "fetch",
            headers: {},
            initiator: data.reqType,
            error: null,
            phase: { queued: 0, waiting: 0, receiving: 0 },
          };
          pendingRef.current.set(data.id, { entry, startTime: data.timestamp });
          addRequest(entry);
        },
        onRequestEnd: (data) => {
          updateRequest(data.id, {
            status:
              data.statusCode >= 200 && data.statusCode < 400
                ? "success"
                : "error",
            statusCode: data.statusCode,
            responseTime: Date.now(),
            duration: data.duration,
            size: data.size,
            phase: {
              queued: 0,
              waiting: data.duration * 0.7,
              receiving: data.duration * 0.3,
            },
          });
          pendingRef.current.delete(data.id);
        },
        onRequestError: (data) => {
          updateRequest(data.id, {
            status: "error",
            duration: data.duration,
            error: data.message,
            responseTime: Date.now(),
          });
          addError({
            id: nanoid(),
            type: "network",
            message: data.message,
            stack: null,
            timestamp: Date.now(),
            route: currentRouteRef.current,
            url: null,
          });
          pendingRef.current.delete(data.id);
        },
        onRouteChange: (path) => {
          trackRouteChange(path);
        },
        onError: (data) => {
          const errEntry: ErrorEntry = {
            id: nanoid(),
            type:
              data.type === "promise_rejection"
                ? "unhandled-rejection"
                : "uncaught",
            message: data.message,
            stack: data.stack ?? null,
            timestamp: Date.now(),
            route: currentRouteRef.current,
            url: null,
          };
          addError(errEntry);
        },
        // Real performance data from same-origin iframes via tracker script
        onPerformance: (data) => {
          setPerformance({
            ttfb: data.ttfb,
            fcp: data.fcp,
            lcp: data.lcp,
            cls: data.cls,
            inp: data.inp,
            domContentLoaded: data.domContentLoaded,
            loadComplete: data.loadComplete,
            resourceCount: data.resourceCount,
            jsSize: data.jsSize,
            cssSize: data.cssSize,
            imageSize: data.imageSize,
            totalSize: data.totalSize,
          });
        },
      });
    },
    // currentRouteRef is a ref — not a dep. trackRouteChange is now stable.
    [addRequest, updateRequest, addError, trackRouteChange, setPerformance],
  );

  useEffect(() => {
    window.addEventListener("message", handleIframeMessage);
    return () => window.removeEventListener("message", handleIframeMessage);
  }, [handleIframeMessage]);

  // Counts how many times the iframe has loaded. Used to distinguish the
  // initial load (probe already fired by mount effect) from navigations.
  const loadCountRef = useRef(0);

  const handleLoad = () => {
    setLoading(false);
    setIframeBlocked(false);
    loadCountRef.current += 1;
    const isFirstLoad = loadCountRef.current === 1;

    // ── Path detection ─────────────────────────────────────────────────────
    // Proxy mode: iframe is same-origin (localhost:3000/api/proxy?url=...).
    // contentWindow.location.pathname is "/api/proxy", not the real path.
    // For initial load derive from the original URL; SPA navigations are
    // covered by route_change postMessages from the injected tracker script.
    let detectedPath: string | null = null;
    if (isProxiedRef.current) {
      if (isFirstLoad) {
        try {
          detectedPath = new URL(url).pathname || "/";
        } catch {
          /* noop */
        }
      }
    } else {
      try {
        const win = iframeRef.current?.contentWindow;
        if (win) detectedPath = win.location.pathname || "/";
      } catch {
        if (isFirstLoad) {
          try {
            detectedPath = new URL(url).pathname || "/";
          } catch {
            /* noop */
          }
        } else {
          detectedPath = `/nav-${loadCountRef.current}`;
        }
      }
    }
    if (detectedPath !== null) {
      trackRouteChange(detectedPath);
    }

    // Fire probe fetch for subsequent loads (initial probe fired by mount effect).
    if (!isFirstLoad) {
      fetch(url, { mode: "no-cors" }).catch(() => {});
    }

    // Inject tracker for non-proxied same-origin iframes.
    // Proxied iframes already have the tracker injected server-side.
    if (!isProxiedRef.current) {
      try {
        const win = iframeRef.current?.contentWindow;
        if (win) {
          const script = win.document.createElement("script");
          script.textContent = buildIframeTrackerScript(window.location.origin);
          (win.document.head ?? win.document.body)?.appendChild(script);
        }
      } catch {
        // Cross-origin — should not happen since cross-origin URLs are proxied.
      }
    }
  };

  const handleError = () => {
    setLoading(false);
    setIframeBlocked(true);
  };

  // Detect X-Frame-Options blocking via timeout (no JS error is fired for CSP/XFO)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) {
        setLoading(false);
        setIframeBlocked(true);
      }
    }, 10000);
    return () => clearTimeout(timer);
  }, [loading, setIframeBlocked]);

  const reload = () => {
    setLoading(true);
    setIframeBlocked(false);
    if (iframeRef.current) {
      iframeRef.current.src = srcUrl;
    }
  };

  if (iframeBlocked) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-zinc-950 gap-4 px-6 text-center">
        <div className="h-14 w-14 rounded-full bg-yellow-950 border border-yellow-800 flex items-center justify-center">
          <AlertTriangle className="h-7 w-7 text-yellow-400" />
        </div>
        <div>
          <h3 className="text-zinc-100 font-semibold text-lg">
            Site cannot be embedded
          </h3>
          <p className="text-zinc-400 text-sm mt-2 max-w-md">
            This website uses{" "}
            <code className="bg-zinc-800 px-1 rounded">X-Frame-Options</code> or{" "}
            <code className="bg-zinc-800 px-1 rounded">
              Content-Security-Policy: frame-ancestors
            </code>{" "}
            headers that prevent embedding in an iframe.
          </p>
          <p className="text-zinc-500 text-sm mt-3 max-w-md">
            NetScope can still track requests from the dashboard if you open the
            site separately and send events manually, but live embedding is
            blocked by the target server.
          </p>
        </div>
        <div className="flex gap-3 mt-2">
          <Button variant="outline" size="sm" onClick={reload}>
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              Open in new tab
            </a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-zinc-950 flex flex-col">
      {/* Status bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 text-xs text-zinc-400 shrink-0">
        <Monitor className="h-3 w-3 text-zinc-500" />
        <span className="text-zinc-500">Simulating:</span>
        <span className="text-zinc-300 font-mono truncate max-w-xs">{url}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 ml-auto"
          onClick={reload}
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
        <a href={url} target="_blank" rel="noopener noreferrer">
          <Button variant="ghost" size="icon" className="h-5 w-5">
            <ExternalLink className="h-3 w-3" />
          </Button>
        </a>
      </div>

      {/* No cross-origin banner — cross-origin sites are transparently proxied
           through /api/proxy which auto-injects the tracker server-side. */}

      {loading && (
        <div className="absolute inset-0 top-8 flex items-center justify-center bg-zinc-950 z-10">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
            <p className="text-xs text-zinc-400">Loading {url}…</p>
          </div>
        </div>
      )}

      <iframe
        ref={iframeRef}
        src={srcUrl}
        className="flex-1 border-0 min-h-0"
        tabIndex={-1}
        onLoad={handleLoad}
        onError={handleError}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation"
        title="NetScope Simulator"
      />
    </div>
  );
}
