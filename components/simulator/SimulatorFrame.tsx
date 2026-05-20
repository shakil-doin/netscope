"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  X,
  Lock,
  Globe,
  ExternalLink,
  AlertTriangle,
  Plus,
} from "lucide-react";
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

function getIframeSrc(target: string): string {
  if (typeof window === "undefined") return "";
  try {
    if (new URL(target).origin !== window.location.origin) {
      return `/api/proxy?url=${encodeURIComponent(target)}`;
    }
  } catch {
    /* invalid URL */
  }
  return target;
}

function getFaviconUrl(siteUrl: string): string {
  try {
    const { hostname } = new URL(siteUrl);
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
  } catch {
    return "";
  }
}

export function SimulatorFrame({ url }: SimulatorFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [displayUrl, setDisplayUrl] = useState(url);
  const [faviconError, setFaviconError] = useState(false);

  const isProxiedRef = useRef(false);
  const srcUrlRef = useRef("");
  const urlRef = useRef(url);

  const [srcUrl, setSrcUrl] = useState("");

  useEffect(() => {
    urlRef.current = url;
    setDisplayUrl(url);
    setFaviconError(false);
    setLoading(true);
    const s = getIframeSrc(url);
    isProxiedRef.current = s !== url;
    srcUrlRef.current = s;
    setSrcUrl(s);
  }, [url]);

  const iframeBlocked = useNetScopeStore((s) => s.iframeBlocked);
  const setIframeBlocked = useNetScopeStore((s) => s.setIframeBlocked);
  const addRequest = useNetScopeStore((s) => s.addRequest);
  const updateRequest = useNetScopeStore((s) => s.updateRequest);
  const addError = useNetScopeStore((s) => s.addError);
  const setPerformance = useNetScopeStore((s) => s.setPerformance);
  const { trackRouteChange } = useRouteTracker();

  const currentRouteRef = useRef(
    useNetScopeStore.getState().session?.currentRoute ?? "/",
  );
  useEffect(() => {
    return useNetScopeStore.subscribe((state) => {
      currentRouteRef.current = state.session?.currentRoute ?? "/";
    });
  }, []);

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
          try {
            const base = new URL(urlRef.current);
            setDisplayUrl(`${base.origin}${path}`);
          } catch {
            setDisplayUrl(urlRef.current);
          }
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
    [addRequest, updateRequest, addError, trackRouteChange, setPerformance],
  );

  useEffect(() => {
    window.addEventListener("message", handleIframeMessage);
    return () => window.removeEventListener("message", handleIframeMessage);
  }, [handleIframeMessage]);

  const loadCountRef = useRef(0);

  const handleLoad = () => {
    if (!srcUrlRef.current) return; // ignore about:blank from empty initial src

    setLoading(false);
    setIframeBlocked(false);
    loadCountRef.current += 1;
    const isFirstLoad = loadCountRef.current === 1;

    let detectedPath: string | null = null;
    if (isProxiedRef.current) {
      if (isFirstLoad) {
        try {
          detectedPath = new URL(urlRef.current).pathname || "/";
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
            detectedPath = new URL(urlRef.current).pathname || "/";
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

    if (!isFirstLoad) {
      fetch(urlRef.current, { mode: "no-cors" }).catch(() => {});
    }

    if (!isProxiedRef.current) {
      try {
        const win = iframeRef.current?.contentWindow;
        if (win) {
          const script = win.document.createElement("script");
          script.textContent = buildIframeTrackerScript(window.location.origin);
          (win.document.head ?? win.document.body)?.appendChild(script);
        }
      } catch {
        /* cross-origin — proxied sites won't reach here */
      }
    }
  };

  // Timeout guard for non-proxied same-origin sites only.
  // Proxied sites can't be blocked by X-Frame-Options (headers stripped server-side).
  useEffect(() => {
    if (isProxiedRef.current) return;
    if (!loading) return;
    const t = setTimeout(() => {
      if (loading) {
        setLoading(false);
        setIframeBlocked(true);
      }
    }, 10_000);
    return () => clearTimeout(t);
  }, [loading, setIframeBlocked]);

  const reload = useCallback(() => {
    loadCountRef.current = 0;
    setLoading(true);
    setIframeBlocked(false);
    setDisplayUrl(urlRef.current);
    if (iframeRef.current) {
      iframeRef.current.src = srcUrlRef.current;
    }
  }, [setIframeBlocked]);

  const goBack = useCallback(() => {
    try {
      iframeRef.current?.contentWindow?.history.back();
    } catch {
      /* cross-origin guard */
    }
  }, []);

  const goForward = useCallback(() => {
    try {
      iframeRef.current?.contentWindow?.history.forward();
    } catch {
      /* cross-origin guard */
    }
  }, []);

  const isHttps = (() => {
    try {
      return new URL(displayUrl).protocol === "https:";
    } catch {
      return false;
    }
  })();

  const faviconUrl = getFaviconUrl(url);

  const tabTitle = (() => {
    try {
      const u = new URL(displayUrl);
      return u.hostname + (u.pathname !== "/" ? u.pathname : "");
    } catch {
      return url;
    }
  })();

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-[#1c1c1e]">
      {/* ── Browser Tab Bar ──────────────────────────────────────────────── */}
      <div className="flex items-end bg-[#28282a] border-b border-[#3a3a3c] pl-3 pr-2 pt-2 shrink-0 select-none">
        {/* macOS traffic lights */}
        <div className="flex items-center gap-1.5 mb-[7px] mr-3 shrink-0">
          <span className="h-[11px] w-[11px] rounded-full bg-[#ff5f57] border border-[#e0443e]/40" />
          <span className="h-[11px] w-[11px] rounded-full bg-[#ffbd2e] border border-[#dea123]/40" />
          <span className="h-[11px] w-[11px] rounded-full bg-[#28c840] border border-[#1aab2e]/40" />
        </div>

        {/* Active tab */}
        <div className="relative flex items-center gap-1.5 bg-[#1c1c1e] border border-[#48484a] border-b-[#1c1c1e] rounded-t-[8px] px-3 h-[30px] max-w-[220px] min-w-0 cursor-default">
          {!faviconError && faviconUrl ? (
            <img
              src={faviconUrl}
              alt=""
              className="h-[14px] w-[14px] shrink-0 rounded-[2px]"
              onError={() => setFaviconError(true)}
            />
          ) : (
            <Globe className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
          )}
          <span className="text-[11px] text-zinc-300 truncate flex-1 leading-none">
            {tabTitle}
          </span>
          <X className="h-3 w-3 text-zinc-600 hover:text-zinc-400 shrink-0 ml-0.5 transition-colors" />
        </div>

        {/* New tab button */}
        <div className="flex items-center justify-center h-[26px] w-[26px] mb-[2px] ml-1.5 rounded-md hover:bg-zinc-700/50 cursor-pointer transition-colors">
          <Plus className="h-3.5 w-3.5 text-zinc-600" />
        </div>
      </div>

      {/* ── Address Bar ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 bg-[#1c1c1e] border-b border-[#3a3a3c] shrink-0">
        <button
          onClick={goBack}
          className="flex items-center justify-center h-7 w-7 rounded-full text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={goForward}
          className="flex items-center justify-center h-7 w-7 rounded-full text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50 transition-colors"
        >
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={reload}
          className="flex items-center justify-center h-7 w-7 rounded-full text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50 transition-colors"
        >
          <RotateCcw
            className={`h-3.5 w-3.5 transition-transform ${loading ? "animate-spin" : ""}`}
          />
        </button>

        {/* URL bar */}
        <div className="flex-1 flex items-center gap-2 bg-[#2c2c2e] border border-[#48484a] hover:border-[#636366] rounded-full px-3 h-7 mx-1.5 cursor-text transition-colors">
          {isHttps ? (
            <Lock className="h-3 w-3 text-green-500/80 shrink-0" />
          ) : (
            <Globe className="h-3 w-3 text-zinc-500 shrink-0" />
          )}
          <span className="flex-1 text-[12px] font-mono text-zinc-200 truncate leading-none select-all">
            {displayUrl}
          </span>
        </div>

        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center h-7 w-7 rounded-full text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50 transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* Loading progress bar */}
      {loading && (
        <div className="h-[2px] shrink-0 bg-[#2c2c2e] overflow-hidden relative">
          <div
            className="absolute inset-y-0 w-[40%] bg-blue-500 rounded-full"
            style={{ animation: "ns-loading-bar 1.3s ease-in-out infinite" }}
          />
        </div>
      )}

      {/* Blocked state */}
      {iframeBlocked ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-[#1c1c1e] gap-5 px-6 text-center">
          <div className="h-14 w-14 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-yellow-400" />
          </div>
          <div>
            <h3 className="text-zinc-100 font-semibold text-base">
              This site can&apos;t be embedded
            </h3>
            <p className="text-zinc-500 text-sm mt-1.5 max-w-sm">
              The server refused to load even through the proxy.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={reload}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Retry
            </button>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              Open in new tab
            </a>
          </div>
        </div>
      ) : (
        <iframe
          ref={iframeRef}
          src={srcUrl}
          className="flex-1 border-0 min-h-0 bg-white"
          tabIndex={-1}
          onLoad={handleLoad}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation"
          title="NetScope Simulator"
        />
      )}
    </div>
  );
}
