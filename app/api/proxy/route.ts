import { NextRequest, NextResponse } from "next/server";

/**
 * Universal HTTP proxy for the NetScope simulator.
 *
 * For the initial page load (HTML):
 *   GET /api/proxy?url=<encoded-url>
 *   → fetches the page server-side, strips frame/CSP headers and meta tags,
 *     injects the tracker as the first script in <head>.
 *
 * For every subsequent JS fetch/XHR call from the proxied app:
 *   The injected tracker rewrites all requests to go through
 *   /api/proxy?url=<absolute-target-url>  (same-origin → no CORS errors).
 *   This handler forwards them (any method + body) to the real target server
 *   and returns the response.
 *
 * The tracker reports the ORIGINAL target URLs to the parent window via
 * postMessage so the Network tab always shows meaningful URLs.
 */

// Headers the proxy must never forward to the target (hop-by-hop / sensitive).
const HOP_BY_HOP = new Set([
  "host",
  "connection",
  "transfer-encoding",
  "upgrade",
  "proxy-authorization",
  "te",
  "trailer",
  "keep-alive",
  "http2-settings",
  "content-length", // recalculated automatically
]);

function buildInlineTracker(targetOrigin: string): string {
  const escaped = JSON.stringify(targetOrigin);
  return `<script>(function(){
if(window.parent===window)return;
if(window.__netscope_active)return;
window.__netscope_active=true;
var _o=${escaped};
var _p=window.parent;
var _ns=window.location.origin;
var _id=function(){return Math.random().toString(36).slice(2,11)+Date.now().toString(36);};
var _msg=function(t,d){try{_p.postMessage(Object.assign({__netscope:true,type:t},d),'*');}catch(e){}};
// Resolve a URL to an absolute target-origin URL
var _abs=function(u){
  if(typeof u!=='string')return u;
  if(/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(u))return u;
  if(u.startsWith('//'))return location.protocol+u;
  if(u.startsWith('/'))return _o+u;
  return _o+'/'+u;
};
// Skip NetScope internal requests
var _skip=function(u){return u.includes('/_next/')|| u.includes('/__nextjs')||u.includes('webpack-hmr')||u.startsWith(_ns+'/api/proxy')||u.startsWith('chrome-extension://')||u.startsWith('moz-extension://');};
// Route an absolute URL through the NetScope proxy (same-origin → no CORS)
var _pu=function(abs){return _ns+'/api/proxy?url='+encodeURIComponent(abs);};
// Patch fetch
var _oF=window.fetch&&window.fetch.bind(window);
if(_oF){
  window.fetch=function(input,init){
    var origUrl=typeof input==='string'?input:(input instanceof URL?input.href:input.url);
    origUrl=_abs(origUrl);
    if(_skip(origUrl))return _oF(input,init);
    var pUrl=_pu(origUrl);
    if(typeof input==='string')input=pUrl;
    else if(input instanceof URL)input=new URL(pUrl);
    else input=pUrl;
    var method=((init&&init.method)||'GET').toUpperCase();
    var id=_id(),t0=performance.now();
    _msg('request_start',{id:id,url:origUrl,method:method,reqType:'fetch',timestamp:Date.now()});
    return _oF(input,init).then(function(r){
      var d=performance.now()-t0;
      r.clone().blob().then(function(b){_msg('request_end',{id:id,statusCode:r.status,duration:d,size:b.size,timestamp:Date.now()});}).catch(function(){_msg('request_end',{id:id,statusCode:r.status,duration:d,size:0,timestamp:Date.now()});});
      return r;
    }).catch(function(e){_msg('request_error',{id:id,message:e.message,duration:performance.now()-t0,timestamp:Date.now()});throw e;});
  };
}
// Patch XHR
var _oO=XMLHttpRequest.prototype.open,_oS=XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.open=function(m,u){
  this.__ns_id=_id();this.__ns_m=m.toUpperCase();
  var origU=_abs(typeof u==='string'?u:String(u));
  this.__ns_u=origU;this.__ns_t=performance.now();
  var dest=_skip(origU)?origU:_pu(origU);
  return _oO.call(this,m,dest,arguments[2],arguments[3]);
};
XMLHttpRequest.prototype.send=function(b){
  var self=this;
  if(!_skip(self.__ns_u))_msg('request_start',{id:self.__ns_id,url:self.__ns_u,method:self.__ns_m,reqType:'xhr',timestamp:Date.now()});
  self.addEventListener('load',function(){if(!_skip(self.__ns_u))_msg('request_end',{id:self.__ns_id,statusCode:self.status,duration:performance.now()-self.__ns_t,size:0,timestamp:Date.now()});});
  self.addEventListener('error',function(){if(!_skip(self.__ns_u))_msg('request_error',{id:self.__ns_id,message:'XHR error',duration:performance.now()-self.__ns_t,timestamp:Date.now()});});
  return _oS.apply(this,arguments);
};
// Route tracking for proxied pages
var _basePath=function(){
  try{
    var raw=new URLSearchParams(location.search).get('url');
    if(raw){
      var u=new URL(raw);
      return u.pathname||'/';
    }
  }catch(e){}
  return '/';
};
var _toTargetURL=function(u){
  if(u==null||u==='')return null;
  try{
    return new URL(String(u),_o+_lp);
  }catch(e){
    return null;
  }
};
var _toProxyHistoryURL=function(u){
  return _ns+'/api/proxy?url='+encodeURIComponent(u.href);
};
var _toPath=function(u){
  var t=_toTargetURL(u);
  return t?(t.pathname||'/'):null;
};
var _lp=_basePath();
// Emit current route once on each document load so full navigations
// (non-SPA links) are counted as page visits.
_msg('route_change',{path:_lp,timestamp:Date.now()});
var _cr=function(next){
  var p=_toPath(next)||_basePath();
  if(p!==_lp){_lp=p;_msg('route_change',{path:_lp,timestamp:Date.now()});}
};
var _oPS=history.pushState,_oRS=history.replaceState;
history.pushState=function(state,title,url){
  var nextPath=_toPath(url);
  var proxied=url;
  var target=_toTargetURL(url);
  if(target)proxied=_toProxyHistoryURL(target);
  _oPS.call(this,state,title,proxied);
  _cr(nextPath);
};
history.replaceState=function(state,title,url){
  var nextPath=_toPath(url);
  var proxied=url;
  var target=_toTargetURL(url);
  if(target)proxied=_toProxyHistoryURL(target);
  _oRS.call(this,state,title,proxied);
  _cr(nextPath);
};
window.addEventListener('popstate',function(){_cr(null);});
// Performance
var _pm={};
var _sp=function(){var nav=performance.getEntriesByType&&performance.getEntriesByType('navigation')[0];var res=(performance.getEntriesByType&&performance.getEntriesByType('resource'))||[];var js=0,css=0,img=0,tot=0;for(var i=0;i<res.length;i++){var s=res[i].transferSize||0;tot+=s;if(res[i].initiatorType==='script')js+=s;else if(res[i].initiatorType==='css'||res[i].initiatorType==='link')css+=s;else if(res[i].initiatorType==='img')img+=s;}_msg('performance',{ttfb:nav?nav.responseStart-nav.requestStart:(_pm.ttfb||null),fcp:_pm.fcp||null,lcp:_pm.lcp||null,cls:_pm.cls||null,inp:_pm.inp||null,domContentLoaded:nav?nav.domContentLoadedEventEnd-nav.startTime:null,loadComplete:nav?nav.loadEventEnd-nav.startTime:null,resourceCount:res.length,jsSize:js,cssSize:css,imageSize:img,totalSize:tot});};
try{var _po=new PerformanceObserver(function(list){list.getEntries().forEach(function(e){if(e.entryType==='paint'&&e.name==='first-contentful-paint')_pm.fcp=e.startTime;if(e.entryType==='largest-contentful-paint')_pm.lcp=e.startTime;if(e.entryType==='layout-shift'&&!e.hadRecentInput)_pm.cls=(_pm.cls||0)+e.value;if(e.entryType==='event'&&e.processingStart){var inp=e.processingStart-e.startTime;if(!_pm.inp||inp>_pm.inp)_pm.inp=inp;}});_sp();});_po.observe({entryTypes:['paint','largest-contentful-paint','layout-shift','event']});}catch(e){}
if(document.readyState==='complete'){_sp();}else{window.addEventListener('load',_sp);}
window.addEventListener('error',function(e){_msg('js_error',{message:e.message,stack:e.error&&e.error.stack,timestamp:Date.now()});});
window.addEventListener('unhandledrejection',function(e){_msg('promise_rejection',{message:String(e.reason),timestamp:Date.now()});});
console.log('%c NetScope tracking active ','background:#2563eb;color:#fff;padding:2px 8px;border-radius:3px;');
})()</script>`;
}

async function proxyHandler(request: NextRequest): Promise<NextResponse> {
  const rawUrl = request.nextUrl.searchParams.get("url");
  if (!rawUrl) return new NextResponse("Missing url param", { status: 400 });

  let targetUrl: URL;
  try {
    targetUrl = new URL(rawUrl);
  } catch {
    return new NextResponse("Invalid URL", { status: 400 });
  }

  if (!["http:", "https:"].includes(targetUrl.protocol)) {
    return new NextResponse("Only http/https URLs are allowed", {
      status: 400,
    });
  }

  // Build forwarded headers — omit hop-by-hop, set origin/referer to target
  // so the server doesn't reject the request as coming from a random origin.
  const forwardedHeaders: Record<string, string> = {
    accept: request.headers.get("accept") ?? "*/*",
    "accept-language":
      request.headers.get("accept-language") ?? "en-US,en;q=0.9",
    "user-agent":
      request.headers.get("user-agent") ??
      "Mozilla/5.0 (compatible; NetScope/1.0)",
    origin: targetUrl.origin,
    referer: rawUrl,
  };
  // Forward content-type for POST/PUT/PATCH bodies
  const ct = request.headers.get("content-type");
  if (ct) forwardedHeaders["content-type"] = ct;
  // Forward any custom app headers (e.g. Authorization, X-CSRF-Token)
  for (const [k, v] of request.headers.entries()) {
    if (!HOP_BY_HOP.has(k.toLowerCase()) && k.toLowerCase().startsWith("x-")) {
      forwardedHeaders[k] = v;
    }
  }

  const method = request.method;
  let body: ArrayBuffer | undefined;
  if (!["GET", "HEAD"].includes(method)) {
    body = await request.arrayBuffer();
  }

  try {
    const res = await fetch(rawUrl, {
      method,
      headers: forwardedHeaders,
      ...(body !== undefined ? { body } : {}),
      redirect: "follow",
    });

    const contentType = res.headers.get("content-type") ?? "";

    // ── HTML response: inject tracker ──────────────────────────────────────
    if (contentType.includes("text/html")) {
      let html = await res.text();
      const origin = targetUrl.origin;

      // Strip any inline Content-Security-Policy meta tags — they would block
      // our injected script.  Response-header CSP is already stripped by not
      // forwarding headers.
      html = html.replace(
        /<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/gi,
        "",
      );

      const injection = `<base href="${origin}/">${buildInlineTracker(origin)}`;
      if (/<head[^>]*>/i.test(html)) {
        html = html.replace(/<head([^>]*)>/i, `<head$1>${injection}`);
      } else if (/<html[^>]*>/i.test(html)) {
        html = html.replace(
          /<html([^>]*)>/i,
          `<html$1><head>${injection}</head>`,
        );
      } else {
        html = injection + html;
      }

      return new NextResponse(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // ── Non-HTML response: forward as-is ────────────────────────────────────
    const data = await res.arrayBuffer();
    const respHeaders: Record<string, string> = {
      "Content-Type": contentType || "application/octet-stream",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    };
    // Forward cookies so auth state is preserved in the proxy session.
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) respHeaders["set-cookie"] = setCookie;

    return new NextResponse(data, {
      status: res.status,
      headers: respHeaders,
    });
  } catch (err) {
    return new NextResponse(`Proxy error: ${String(err)}`, { status: 502 });
  }
}

export const GET = proxyHandler;
export const POST = proxyHandler;
export const PUT = proxyHandler;
export const PATCH = proxyHandler;
export const DELETE = proxyHandler;
export const OPTIONS = proxyHandler;
