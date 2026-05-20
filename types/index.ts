// ─── Network Request ─────────────────────────────────────────────────────────

export type RequestMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "OPTIONS"
  | "HEAD";
export type RequestStatus =
  | "pending"
  | "success"
  | "error"
  | "timeout"
  | "aborted";
export type RequestType = "fetch" | "xhr" | "resource";

export interface RequestEntry {
  id: string;
  url: string;
  method: RequestMethod;
  status: RequestStatus;
  statusCode: number | null;
  requestTime: number; // timestamp ms when request started
  responseTime: number | null; // timestamp ms when response received
  duration: number | null; // ms
  size: number | null; // response bytes
  route: string; // page route at time of request
  type: RequestType;
  headers: Record<string, string>;
  initiator: string;
  error: string | null;
  phase: {
    queued: number;
    waiting: number;
    receiving: number;
  };
}

// ─── Performance ─────────────────────────────────────────────────────────────

export interface PerformanceMetrics {
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
}

export interface ResourceEntry {
  name: string;
  type: string;
  size: number;
  duration: number;
  startTime: number;
  initiatorType: string;
}

// ─── Route ───────────────────────────────────────────────────────────────────

export interface RouteEntry {
  path: string;
  visitedAt: number;
  leaveAt: number | null;
  apiCallCount: number;
  failedCount: number;
  avgResponseTime: number;
  totalLoadTime: number | null;
}

// ─── Error ───────────────────────────────────────────────────────────────────

export type ErrorType =
  | "uncaught"
  | "unhandled-rejection"
  | "network"
  | "cors"
  | "timeout";

export interface ErrorEntry {
  id: string;
  type: ErrorType;
  message: string;
  stack: string | null;
  timestamp: number;
  route: string;
  url: string | null;
}

// ─── Session ─────────────────────────────────────────────────────────────────

export interface SessionData {
  targetUrl: string;
  startTime: number;
  currentRoute: string;
  requests: RequestEntry[];
  errors: ErrorEntry[];
  routes: RouteEntry[];
  performance: PerformanceMetrics | null;
  resources: ResourceEntry[];
  isActive: boolean;
}

// ─── UI ──────────────────────────────────────────────────────────────────────

export type DashboardTab =
  | "network"
  | "performance"
  | "routes"
  | "errors"
  | "timeline";

export interface FilterState {
  search: string;
  method: string;
  status: string;
  type: string;
  route: string;
  sortBy: "time" | "duration" | "size" | "status" | "method";
  sortDir: "asc" | "desc";
}
