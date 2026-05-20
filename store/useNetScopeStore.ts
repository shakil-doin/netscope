import { create } from "zustand";
import type {
  SessionData,
  RequestEntry,
  ErrorEntry,
  RouteEntry,
  PerformanceMetrics,
  ResourceEntry,
  DashboardTab,
  FilterState,
} from "@/types";

const SESSION_KEY = "netscope_session";

function loadSession(): SessionData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SessionData) : null;
  } catch {
    return null;
  }
}

function saveSession(data: SessionData) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch {
    // sessionStorage quota exceeded – silently drop
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface NetScopeState {
  // Session
  session: SessionData | null;
  activeTab: DashboardTab;
  filters: FilterState;
  sidebarOpen: boolean;
  iframeBlocked: boolean;

  // Actions
  startSession: (url: string) => void;
  endSession: () => void;
  addRequest: (req: RequestEntry) => void;
  updateRequest: (id: string, patch: Partial<RequestEntry>) => void;
  addError: (err: ErrorEntry) => void;
  upsertRoute: (route: RouteEntry) => void;
  setCurrentRoute: (path: string) => void;
  setPerformance: (metrics: PerformanceMetrics) => void;
  addResource: (resource: ResourceEntry) => void;
  setActiveTab: (tab: DashboardTab) => void;
  setFilters: (filters: Partial<FilterState>) => void;
  clearFilters: () => void;
  setSidebarOpen: (open: boolean) => void;
  setIframeBlocked: (blocked: boolean) => void;
  clearSession: () => void;
  hydrate: () => void;
  setResources: (resources: ResourceEntry[]) => void;
}

const defaultFilters: FilterState = {
  search: "",
  method: "all",
  status: "all",
  type: "all",
  route: "all",
  sortBy: "time",
  sortDir: "asc",
};

export const useNetScopeStore = create<NetScopeState>((set, get) => ({
  session: null,
  activeTab: "network",
  filters: defaultFilters,
  sidebarOpen: true,
  iframeBlocked: false,

  hydrate: () => {
    const saved = loadSession();
    if (saved) set({ session: saved });
  },

  startSession: (url: string) => {
    // Derive the actual pathname from the URL so requests and the initial
    // RouteEntry are attributed to e.g. "/products" not always "/".
    let initialPath = "/";
    try {
      initialPath = new URL(url).pathname || "/";
    } catch {
      /* invalid URL */
    }
    const now = Date.now();
    const session: SessionData = {
      targetUrl: url,
      startTime: now,
      currentRoute: initialPath,
      requests: [],
      errors: [],
      // Pre-create a RouteEntry for the landing page so the Routes tab is
      // never empty after session start.
      routes: [
        {
          path: initialPath,
          visitedAt: now,
          leaveAt: null,
          apiCallCount: 0,
          failedCount: 0,
          avgResponseTime: 0,
          totalLoadTime: null,
        },
      ],
      performance: null,
      resources: [],
      isActive: true,
    };
    set({ session, iframeBlocked: false });
    saveSession(session);
  },

  endSession: () => {
    const { session } = get();
    if (!session) return;
    const updated = { ...session, isActive: false };
    set({ session: updated });
    saveSession(updated);
  },

  addRequest: (req) => {
    const { session } = get();
    if (!session) return;
    const updated = { ...session, requests: [...session.requests, req] };
    set({ session: updated });
    saveSession(updated);
  },

  updateRequest: (id, patch) => {
    const { session } = get();
    if (!session) return;
    const requests = session.requests.map((r) =>
      r.id === id ? { ...r, ...patch } : r,
    );
    const updated = { ...session, requests };
    set({ session: updated });
    saveSession(updated);
  },

  addError: (err) => {
    const { session } = get();
    if (!session) return;
    const updated = { ...session, errors: [...session.errors, err] };
    set({ session: updated });
    saveSession(updated);
  },

  upsertRoute: (route) => {
    const { session } = get();
    if (!session) return;
    const existing = session.routes.findIndex((r) => r.path === route.path);
    const routes =
      existing >= 0
        ? session.routes.map((r, i) =>
            i === existing ? { ...r, ...route } : r,
          )
        : [...session.routes, route];
    const updated = { ...session, routes };
    set({ session: updated });
    saveSession(updated);
  },

  setCurrentRoute: (path) => {
    const { session } = get();
    if (!session) return;
    const updated = { ...session, currentRoute: path };
    set({ session: updated });
    saveSession(updated);
  },

  setPerformance: (metrics) => {
    const { session } = get();
    if (!session) return;
    const updated = { ...session, performance: metrics };
    set({ session: updated });
    saveSession(updated);
  },

  addResource: (resource) => {
    const { session } = get();
    if (!session) return;
    const updated = { ...session, resources: [...session.resources, resource] };
    set({ session: updated });
    saveSession(updated);
  },

  setResources: (resources) => {
    const { session } = get();
    if (!session) return;
    const updated = { ...session, resources };
    set({ session: updated });
    saveSession(updated);
  },

  setActiveTab: (tab) => set({ activeTab: tab }),

  setFilters: (filters) =>
    set((state) => ({ filters: { ...state.filters, ...filters } })),

  clearFilters: () => set({ filters: defaultFilters }),

  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  setIframeBlocked: (blocked) => set({ iframeBlocked: blocked }),

  clearSession: () => {
    if (typeof window !== "undefined") sessionStorage.removeItem(SESSION_KEY);
    set({ session: null, iframeBlocked: false, filters: defaultFilters });
  },
}));
