"use client";

import { useEffect, useRef } from "react";
import { useNetScopeStore } from "@/store/useNetScopeStore";
import { nanoid, getPathname } from "@/lib/utils";
import type { RequestEntry, ErrorEntry, RequestMethod } from "@/types";

interface XhrMeta {
  id: string;
  method: RequestMethod;
  url: string;
  startTime: number;
}

const xhrMetaMap = new WeakMap<XMLHttpRequest, XhrMeta>();

export function useNetworkTracker(enabled: boolean) {
  const addRequest = useNetScopeStore((s) => s.addRequest);
  const updateRequest = useNetScopeStore((s) => s.updateRequest);
  const addError = useNetScopeStore((s) => s.addError);
  // Do NOT subscribe to session here — read it via getState() inside callbacks
  // so changing requests never causes this hook's effect to re-run.
  const patchedRef = useRef(false);
  const originalFetch = useRef<typeof fetch | null>(null);
  const originalXhrOpen = useRef<typeof XMLHttpRequest.prototype.open | null>(
    null,
  );
  const originalXhrSend = useRef<typeof XMLHttpRequest.prototype.send | null>(
    null,
  );

  // Helper to get the current route without subscribing to the store
  const getCurrentRoute = () =>
    getPathname(useNetScopeStore.getState().session?.currentRoute ?? "/");

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || patchedRef.current) return;
    patchedRef.current = true;
    // Save originals before patching — used for cleanup below

    // ── Patch fetch ────────────────────────────────────────────────────────
    originalFetch.current = window.fetch.bind(window);
    window.fetch = async function patchedFetch(
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : (input as Request).url;

      // Skip Next.js internals, HMR, and browser extension URLs
      if (
        url.includes("/_next/") ||
        url.includes("/__nextjs") ||
        url.includes("webpack-hmr") ||
        url.startsWith("chrome-extension://") ||
        url.startsWith("moz-extension://")
      ) {
        return originalFetch.current!(input, init);
      }

      const method = (
        (init?.method ?? "GET") as string
      ).toUpperCase() as RequestMethod;
      const id = nanoid();
      const requestTime = performance.now();
      const route = getCurrentRoute();

      const entry: RequestEntry = {
        id,
        url,
        method,
        status: "pending",
        statusCode: null,
        requestTime: Date.now(),
        responseTime: null,
        duration: null,
        size: null,
        route,
        type: "fetch",
        headers: {},
        initiator: "fetch",
        error: null,
        phase: { queued: 0, waiting: 0, receiving: 0 },
      };
      addRequest(entry);

      try {
        const response = await originalFetch.current!(input, init);
        const duration = performance.now() - requestTime;
        const clone = response.clone();
        const blob = await clone.blob().catch(() => null);
        const size = blob?.size ?? null;
        updateRequest(id, {
          status: response.ok ? "success" : "error",
          statusCode: response.status,
          responseTime: Date.now(),
          duration,
          size,
          phase: {
            queued: 0,
            waiting: duration * 0.7,
            receiving: duration * 0.3,
          },
        });
        return response;
      } catch (err) {
        const duration = performance.now() - requestTime;
        const message = err instanceof Error ? err.message : String(err);
        updateRequest(id, {
          status: "error",
          statusCode: null,
          responseTime: Date.now(),
          duration,
          error: message,
        });
        const errorEntry: ErrorEntry = {
          id: nanoid(),
          type: message.toLowerCase().includes("cors") ? "cors" : "network",
          message,
          stack: err instanceof Error ? (err.stack ?? null) : null,
          timestamp: Date.now(),
          route,
          url,
        };
        addError(errorEntry);
        throw err;
      }
    };

    // ── Patch XHR ──────────────────────────────────────────────────────────
    originalXhrOpen.current = XMLHttpRequest.prototype.open;
    originalXhrSend.current = XMLHttpRequest.prototype.send;

    const capturedOpen = originalXhrOpen.current;
    const capturedSend = originalXhrSend.current;

    XMLHttpRequest.prototype.open = function (
      method: string,
      url: string | URL,
      async?: boolean,
      user?: string | null,
      password?: string | null,
    ) {
      xhrMetaMap.set(this, {
        id: nanoid(),
        method: method.toUpperCase() as RequestMethod,
        url: typeof url === "string" ? url : url.href,
        startTime: performance.now(),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (capturedOpen as any).call(
        this,
        method,
        url,
        async ?? true,
        user,
        password,
      );
    };

    XMLHttpRequest.prototype.send = function (
      body?: Document | XMLHttpRequestBodyInit | null,
    ) {
      const meta = xhrMetaMap.get(this);
      const id = meta?.id ?? nanoid();
      const method: RequestMethod = meta?.method ?? "GET";
      const url = meta?.url ?? "";
      const startPerf = meta?.startTime ?? performance.now();
      const route = getPathname(
        useNetScopeStore.getState().session?.currentRoute ?? "/",
      );

      const entry: RequestEntry = {
        id,
        url,
        method,
        status: "pending",
        statusCode: null,
        requestTime: Date.now(),
        responseTime: null,
        duration: null,
        size: null,
        route,
        type: "xhr",
        headers: {},
        initiator: "xhr",
        error: null,
        phase: { queued: 0, waiting: 0, receiving: 0 },
      };
      addRequest(entry);

      this.addEventListener("load", () => {
        const duration = performance.now() - startPerf;
        const size =
          typeof this.response === "string"
            ? this.response.length
            : this.response instanceof ArrayBuffer
              ? this.response.byteLength
              : null;
        updateRequest(id, {
          status: this.status >= 200 && this.status < 400 ? "success" : "error",
          statusCode: this.status,
          responseTime: Date.now(),
          duration,
          size,
          phase: {
            queued: 0,
            waiting: duration * 0.7,
            receiving: duration * 0.3,
          },
        });
        xhrMetaMap.delete(this);
      });

      this.addEventListener("error", () => {
        const duration = performance.now() - startPerf;
        updateRequest(id, {
          status: "error",
          statusCode: null,
          responseTime: Date.now(),
          duration,
          error: "XHR network error",
        });
        addError({
          id: nanoid(),
          type: "network",
          message: `XHR failed: ${url}`,
          stack: null,
          timestamp: Date.now(),
          route,
          url,
        });
        xhrMetaMap.delete(this);
      });

      this.addEventListener("timeout", () => {
        updateRequest(id, { status: "timeout", error: "Request timed out" });
        xhrMetaMap.delete(this);
      });

      this.addEventListener("abort", () => {
        updateRequest(id, { status: "aborted", error: "Request aborted" });
        xhrMetaMap.delete(this);
      });

      return capturedSend.call(this, body);
    };

    // ── Global error handlers ──────────────────────────────────────────────
    const handleError = (event: ErrorEvent) => {
      addError({
        id: nanoid(),
        type: "uncaught",
        message: event.message,
        stack: (event.error as Error | null)?.stack ?? null,
        timestamp: Date.now(),
        route: getCurrentRoute(),
        url: event.filename ?? null,
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason as unknown;
      addError({
        id: nanoid(),
        type: "unhandled-rejection",
        message: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? (reason.stack ?? null) : null,
        timestamp: Date.now(),
        route: getCurrentRoute(),
        url: null,
      });
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      if (originalFetch.current) window.fetch = originalFetch.current;
      if (originalXhrOpen.current)
        XMLHttpRequest.prototype.open = originalXhrOpen.current;
      if (originalXhrSend.current)
        XMLHttpRequest.prototype.send = originalXhrSend.current;
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
      patchedRef.current = false;
    };
    // addRequest/updateRequest/addError are stable Zustand actions.
    // getCurrentRoute reads getState() so no need to put session in deps.
  }, [enabled, addRequest, updateRequest, addError]);
}
