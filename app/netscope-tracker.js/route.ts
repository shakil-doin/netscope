import { NextResponse } from "next/server";

// The tracker script is served at /netscope-tracker.js with open CORS headers
// so any app on any origin can load it via <script src="http://localhost:3001/netscope-tracker.js">
// When loaded inside an iframe it automatically patches fetch/XHR and posts
// all request events to the parent window (NetScope dashboard).

const TRACKER_SCRIPT = `
(function () {
  // Only activate when running inside NetScope's iframe.
  // window.parent !== window means we are in an iframe.
  if (window.parent === window) return;
  // Guard against double-injection (e.g. hot-reload).
  if (window.__netscope_active) return;
  window.__netscope_active = true;

  var _parent = window.parent;
  var _id = function () {
    return Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
  };
  var _send = function (type, data) {
    try {
      _parent.postMessage(Object.assign({ __netscope: true, type: type }, data), "*");
    } catch (e) {}
  };

  // ── Patch fetch ──────────────────────────────────────────────────────────
  var _oFetch = window.fetch && window.fetch.bind(window);
  if (_oFetch) {
    window.fetch = function (input, init) {
      var url =
        typeof input === "string"
          ? input
          : input instanceof URL
          ? input.href
          : input.url;
      var method = ((init && init.method) || "GET").toUpperCase();
      var id = _id();
      var t0 = performance.now();
      _send("request_start", { id: id, url: url, method: method, reqType: "fetch", timestamp: Date.now() });
      return _oFetch(input, init)
        .then(function (res) {
          var dur = performance.now() - t0;
          res.clone().blob().then(function (b) {
            _send("request_end", { id: id, statusCode: res.status, duration: dur, size: b.size, timestamp: Date.now() });
          }).catch(function () {
            _send("request_end", { id: id, statusCode: res.status, duration: dur, size: 0, timestamp: Date.now() });
          });
          return res;
        })
        .catch(function (err) {
          _send("request_error", { id: id, message: err.message, duration: performance.now() - t0, timestamp: Date.now() });
          throw err;
        });
    };
  }

  // ── Patch XHR ────────────────────────────────────────────────────────────
  var _oOpen = XMLHttpRequest.prototype.open;
  var _oSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__ns_id = _id();
    this.__ns_m = method.toUpperCase();
    this.__ns_u = typeof url === "string" ? url : String(url);
    this.__ns_t = performance.now();
    return _oOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function (body) {
    var self = this;
    _send("request_start", { id: self.__ns_id, url: self.__ns_u, method: self.__ns_m, reqType: "xhr", timestamp: Date.now() });
    self.addEventListener("load", function () {
      _send("request_end", { id: self.__ns_id, statusCode: self.status, duration: performance.now() - self.__ns_t, size: 0, timestamp: Date.now() });
    });
    self.addEventListener("error", function () {
      _send("request_error", { id: self.__ns_id, message: "XHR error", duration: performance.now() - self.__ns_t, timestamp: Date.now() });
    });
    return _oSend.apply(this, arguments);
  };

  // ── Route tracking (SPA + MPA) ────────────────────────────────────────────
  var _lastPath = location.pathname;
  var _checkRoute = function () {
    if (location.pathname !== _lastPath) {
      _lastPath = location.pathname;
      _send("route_change", { path: _lastPath, timestamp: Date.now() });
    }
  };
  var _oPS = history.pushState;
  var _oRS = history.replaceState;
  history.pushState = function () { _oPS.apply(this, arguments); _checkRoute(); };
  history.replaceState = function () { _oRS.apply(this, arguments); _checkRoute(); };
  window.addEventListener("popstate", _checkRoute);

  // ── Performance metrics ───────────────────────────────────────────────────
  var _pm = {};
  var _sendPerf = function () {
    var nav = performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
    var res = (performance.getEntriesByType && performance.getEntriesByType("resource")) || [];
    var jsSize = 0, cssSize = 0, imageSize = 0, totalSize = 0;
    for (var i = 0; i < res.length; i++) {
      var s = res[i].transferSize || 0; totalSize += s;
      if (res[i].initiatorType === "script") jsSize += s;
      else if (res[i].initiatorType === "css" || res[i].initiatorType === "link") cssSize += s;
      else if (res[i].initiatorType === "img") imageSize += s;
    }
    _send("performance", {
      ttfb: nav ? nav.responseStart - nav.requestStart : (_pm.ttfb || null),
      fcp: _pm.fcp || null, lcp: _pm.lcp || null, cls: _pm.cls || null, inp: _pm.inp || null,
      domContentLoaded: nav ? nav.domContentLoadedEventEnd - nav.startTime : null,
      loadComplete: nav ? nav.loadEventEnd - nav.startTime : null,
      resourceCount: res.length, jsSize: jsSize, cssSize: cssSize, imageSize: imageSize, totalSize: totalSize,
    });
  };
  try {
    var _po = new PerformanceObserver(function (list) {
      list.getEntries().forEach(function (e) {
        if (e.entryType === "paint" && e.name === "first-contentful-paint") _pm.fcp = e.startTime;
        if (e.entryType === "largest-contentful-paint") _pm.lcp = e.startTime;
        if (e.entryType === "layout-shift" && !e.hadRecentInput) _pm.cls = (_pm.cls || 0) + e.value;
        if (e.entryType === "event" && e.processingStart) {
          var inp = e.processingStart - e.startTime;
          if (!_pm.inp || inp > _pm.inp) _pm.inp = inp;
        }
      });
      _sendPerf();
    });
    _po.observe({ entryTypes: ["paint", "largest-contentful-paint", "layout-shift", "event"] });
  } catch (e) {}
  if (document.readyState === "complete") { _sendPerf(); }
  else { window.addEventListener("load", _sendPerf); }

  // ── Error tracking ────────────────────────────────────────────────────────
  window.addEventListener("error", function (e) {
    _send("js_error", { message: e.message, stack: e.error && e.error.stack, timestamp: Date.now() });
  });
  window.addEventListener("unhandledrejection", function (e) {
    _send("promise_rejection", { message: String(e.reason), timestamp: Date.now() });
  });

  console.log("%c NetScope tracker active ", "background:#2563eb;color:#fff;padding:2px 8px;border-radius:3px;font-weight:bold;");
})();
`;

export async function GET() {
  return new NextResponse(TRACKER_SCRIPT, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
      // Allow any origin to load this script
      "Access-Control-Allow-Origin": "*",
    },
  });
}
