"use client";

import { useEffect, useRef } from "react";
import { useNetScopeStore } from "@/store/useNetScopeStore";
import { nanoid } from "@/lib/utils";
import type { PerformanceMetrics, ResourceEntry } from "@/types";

export function usePerformanceMetrics(enabled: boolean) {
  const setPerformance = useNetScopeStore((s) => s.setPerformance);
  const setResources = useNetScopeStore((s) => s.setResources);
  const observerRef = useRef<PerformanceObserver | null>(null);
  const metricsRef = useRef<Partial<PerformanceMetrics>>({});

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    // ── Navigation timing ─────────────────────────────────────────────────
    const collectNavigation = () => {
      const [nav] = performance.getEntriesByType(
        "navigation",
      ) as PerformanceNavigationTiming[];
      if (nav) {
        metricsRef.current.ttfb = nav.responseStart - nav.requestStart;
        metricsRef.current.domContentLoaded =
          nav.domContentLoadedEventEnd - nav.startTime;
        metricsRef.current.loadComplete = nav.loadEventEnd - nav.startTime;
      }
    };

    // ── Resources ─────────────────────────────────────────────────────────
    const collectResources = () => {
      const entries = performance.getEntriesByType(
        "resource",
      ) as PerformanceResourceTiming[];
      let jsSize = 0;
      let cssSize = 0;
      let imageSize = 0;
      let totalSize = 0;
      let resourceCount = 0;
      const allResources: ResourceEntry[] = [];

      entries.forEach((entry) => {
        const size = entry.transferSize ?? 0;
        totalSize += size;
        resourceCount++;
        const type = entry.initiatorType;
        if (type === "script") jsSize += size;
        else if (type === "css" || type === "link") cssSize += size;
        else if (type === "img") imageSize += size;

        allResources.push({
          name: entry.name,
          type: entry.initiatorType,
          size,
          duration: entry.duration,
          startTime: entry.startTime,
          initiatorType: entry.initiatorType,
        });
      });

      // One bulk update instead of N individual store writes
      setResources(allResources);

      metricsRef.current.jsSize = jsSize;
      metricsRef.current.cssSize = cssSize;
      metricsRef.current.imageSize = imageSize;
      metricsRef.current.totalSize = totalSize;
      metricsRef.current.resourceCount = resourceCount;
    };

    // ── Web Vitals via PerformanceObserver ────────────────────────────────
    const flush = () => {
      setPerformance({
        ttfb: metricsRef.current.ttfb ?? null,
        fcp: metricsRef.current.fcp ?? null,
        lcp: metricsRef.current.lcp ?? null,
        cls: metricsRef.current.cls ?? null,
        inp: metricsRef.current.inp ?? null,
        domContentLoaded: metricsRef.current.domContentLoaded ?? null,
        loadComplete: metricsRef.current.loadComplete ?? null,
        resourceCount: metricsRef.current.resourceCount ?? 0,
        jsSize: metricsRef.current.jsSize ?? 0,
        cssSize: metricsRef.current.cssSize ?? 0,
        imageSize: metricsRef.current.imageSize ?? 0,
        totalSize: metricsRef.current.totalSize ?? 0,
      });
    };

    try {
      observerRef.current = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (
            entry.entryType === "paint" &&
            entry.name === "first-contentful-paint"
          ) {
            metricsRef.current.fcp = entry.startTime;
          }
          if (entry.entryType === "largest-contentful-paint") {
            metricsRef.current.lcp = entry.startTime;
          }
          if (entry.entryType === "layout-shift") {
            const ls = entry as PerformanceEntry & {
              value: number;
              hadRecentInput: boolean;
            };
            if (!ls.hadRecentInput) {
              metricsRef.current.cls = (metricsRef.current.cls ?? 0) + ls.value;
            }
          }
          if (entry.entryType === "event") {
            const ev = entry as PerformanceEventTiming;
            const inp = ev.processingStart - ev.startTime;
            if (!metricsRef.current.inp || inp > metricsRef.current.inp) {
              metricsRef.current.inp = inp;
            }
          }
        });
        flush();
      });

      observerRef.current.observe({
        entryTypes: [
          "paint",
          "largest-contentful-paint",
          "layout-shift",
          "event",
        ],
      });
    } catch {
      // Browser may not support all entry types
    }

    if (document.readyState === "complete") {
      collectNavigation();
      collectResources();
      // Flush immediately AND after a macrotask. The immediate flush may find
      // session === null (startSession runs in a later effect). The deferred
      // flush runs after all mount effects complete, so session exists by then.
      flush();
      setTimeout(flush, 0);
    } else {
      window.addEventListener("load", () => {
        collectNavigation();
        collectResources();
        flush();
        setTimeout(flush, 0);
      });
    }

    const intervalId = setInterval(() => {
      collectResources();
      flush();
    }, 2000);

    return () => {
      observerRef.current?.disconnect();
      clearInterval(intervalId);
    };
  }, [enabled, setPerformance, setResources]);
}

// ─── Inject tracker script into iframe ───────────────────────────────────────

export function buildIframeTrackerScript(targetOrigin: string): string {
  return `
(function() {
  var _targetOrigin = ${JSON.stringify(targetOrigin)};
  var _originalFetch = window.fetch && window.fetch.bind(window);
  var _originalOpen = XMLHttpRequest.prototype.open;
  var _originalSend = XMLHttpRequest.prototype.send;
  var _id = function() { return Math.random().toString(36).slice(2,11)+Date.now().toString(36); };

  if (_originalFetch) {
    window.fetch = function(input, init) {
      var url = typeof input === 'string' ? input : (input instanceof URL ? input.href : input.url);
      var method = ((init && init.method) || 'GET').toUpperCase();
      var id = _id();
      var startTime = performance.now();
      window.parent.postMessage({ __netscope: true, type: 'request_start', id: id, url: url, method: method, reqType: 'fetch', timestamp: Date.now() }, _targetOrigin);
      return _originalFetch(input, init).then(function(res) {
        var duration = performance.now() - startTime;
        var clone = res.clone();
        clone.blob().then(function(b) {
          window.parent.postMessage({ __netscope: true, type: 'request_end', id: id, statusCode: res.status, duration: duration, size: b.size, timestamp: Date.now() }, _targetOrigin);
        }).catch(function() {
          window.parent.postMessage({ __netscope: true, type: 'request_end', id: id, statusCode: res.status, duration: duration, size: 0, timestamp: Date.now() }, _targetOrigin);
        });
        return res;
      }).catch(function(err) {
        var duration = performance.now() - startTime;
        window.parent.postMessage({ __netscope: true, type: 'request_error', id: id, message: err.message, duration: duration, timestamp: Date.now() }, _targetOrigin);
        throw err;
      });
    };
  }

  XMLHttpRequest.prototype.open = function(method, url) {
    this.__ns_id = _id(); this.__ns_method = method.toUpperCase(); this.__ns_url = typeof url === 'string' ? url : url.href; this.__ns_start = performance.now();
    return _originalOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function(body) {
    var self = this;
    window.parent.postMessage({ __netscope: true, type: 'request_start', id: self.__ns_id, url: self.__ns_url, method: self.__ns_method, reqType: 'xhr', timestamp: Date.now() }, _targetOrigin);
    self.addEventListener('load', function() {
      var duration = performance.now() - self.__ns_start;
      window.parent.postMessage({ __netscope: true, type: 'request_end', id: self.__ns_id, statusCode: self.status, duration: duration, size: 0, timestamp: Date.now() }, _targetOrigin);
    });
    self.addEventListener('error', function() {
      window.parent.postMessage({ __netscope: true, type: 'request_error', id: self.__ns_id, message: 'XHR error', duration: performance.now() - self.__ns_start, timestamp: Date.now() }, _targetOrigin);
    });
    return _originalSend.apply(this, arguments);
  };

  // Route changes
  var _lastPath = location.pathname;
  var _checkRoute = function() {
    if (location.pathname !== _lastPath) {
      _lastPath = location.pathname;
      window.parent.postMessage({ __netscope: true, type: 'route_change', path: _lastPath, timestamp: Date.now() }, _targetOrigin);
    }
  };
  var _origPushState = history.pushState;
  var _origReplaceState = history.replaceState;
  history.pushState = function() { _origPushState.apply(this, arguments); _checkRoute(); };
  history.replaceState = function() { _origReplaceState.apply(this, arguments); _checkRoute(); };
  window.addEventListener('popstate', _checkRoute);

  // Performance metrics — send real measurements from inside the iframe
  var _pm = {};
  var _sendPerf = function() {
    var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    var res = (performance.getEntriesByType && performance.getEntriesByType('resource')) || [];
    var jsSize = 0, cssSize = 0, imageSize = 0, totalSize = 0;
    for (var i = 0; i < res.length; i++) {
      var s = res[i].transferSize || 0; totalSize += s;
      if (res[i].initiatorType === 'script') jsSize += s;
      else if (res[i].initiatorType === 'css' || res[i].initiatorType === 'link') cssSize += s;
      else if (res[i].initiatorType === 'img') imageSize += s;
    }
    window.parent.postMessage({
      __netscope: true, type: 'performance',
      ttfb: nav ? (nav.responseStart - nav.requestStart) : (_pm.ttfb || null),
      fcp: _pm.fcp || null, lcp: _pm.lcp || null, cls: _pm.cls || null, inp: _pm.inp || null,
      domContentLoaded: nav ? (nav.domContentLoadedEventEnd - nav.startTime) : null,
      loadComplete: nav ? (nav.loadEventEnd - nav.startTime) : null,
      resourceCount: res.length, jsSize: jsSize, cssSize: cssSize, imageSize: imageSize, totalSize: totalSize
    }, _targetOrigin);
  };
  try {
    var _po = new PerformanceObserver(function(list) {
      list.getEntries().forEach(function(e) {
        if (e.entryType === 'paint' && e.name === 'first-contentful-paint') _pm.fcp = e.startTime;
        if (e.entryType === 'largest-contentful-paint') _pm.lcp = e.startTime;
        if (e.entryType === 'layout-shift' && !e.hadRecentInput) _pm.cls = (_pm.cls || 0) + e.value;
        if (e.entryType === 'event' && e.processingStart) { var inp = e.processingStart - e.startTime; if (!_pm.inp || inp > _pm.inp) _pm.inp = inp; }
      });
      _sendPerf();
    });
    _po.observe({ entryTypes: ['paint', 'largest-contentful-paint', 'layout-shift', 'event'] });
  } catch(e) {}
  if (document.readyState === 'complete') { _sendPerf(); } else { window.addEventListener('load', _sendPerf); }
  window.addEventListener('error', function(e) {
    window.parent.postMessage({ __netscope: true, type: 'js_error', message: e.message, stack: e.error && e.error.stack, timestamp: Date.now() }, _targetOrigin);
  });
  window.addEventListener('unhandledrejection', function(e) {
    window.parent.postMessage({ __netscope: true, type: 'promise_rejection', message: String(e.reason), timestamp: Date.now() }, _targetOrigin);
  });
})();
`;
}

export function generateNanoId(): string {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

export function processIframeMessage(
  event: MessageEvent,
  handlers: {
    onRequestStart: (data: {
      id: string;
      url: string;
      method: string;
      reqType: string;
      timestamp: number;
      route: string;
    }) => void;
    onRequestEnd: (data: {
      id: string;
      statusCode: number;
      duration: number;
      size: number;
    }) => void;
    onRequestError: (data: {
      id: string;
      message: string;
      duration: number;
    }) => void;
    onRouteChange: (path: string) => void;
    onError: (data: { type: string; message: string; stack?: string }) => void;
    onPerformance?: (data: {
      ttfb: number | null;
      fcp: number | null;
      lcp: number | null;
      cls: number | null;
      inp: number | null;
      domContentLoaded: number | null;
      loadComplete: number | null;
      resourceCount: number;
      jsSize: number;
      cssSize: number;
      imageSize: number;
      totalSize: number;
    }) => void;
  },
) {
  const d = event.data;
  if (!d || !d.__netscope) return;
  if (d.type === "request_start")
    handlers.onRequestStart({ ...d, route: d.route ?? "/" });
  if (d.type === "request_end") handlers.onRequestEnd(d);
  if (d.type === "request_error") handlers.onRequestError(d);
  if (d.type === "route_change") handlers.onRouteChange(d.path);
  if (d.type === "js_error" || d.type === "promise_rejection")
    handlers.onError(d);
  if (d.type === "performance" && handlers.onPerformance)
    handlers.onPerformance(d);
}
