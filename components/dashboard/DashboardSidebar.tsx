"use client";

import {
  Network,
  Activity,
  Globe,
  AlertCircle,
  Timer,
  Menu,
  X,
  Trash2,
  Download,
  Home,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useNetScopeStore } from "@/store/useNetScopeStore";
import { cn } from "@/lib/utils";
import type { DashboardTab } from "@/types";
import Link from "next/link";

const TABS: {
  id: DashboardTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "network", label: "Network", icon: Network },
  { id: "performance", label: "Performance", icon: Activity },
  { id: "routes", label: "Routes", icon: Globe },
  { id: "errors", label: "Errors", icon: AlertCircle },
  { id: "timeline", label: "Timeline", icon: Timer },
];

export function DashboardSidebar() {
  const activeTab = useNetScopeStore((s) => s.activeTab);
  const setActiveTab = useNetScopeStore((s) => s.setActiveTab);
  const sidebarOpen = useNetScopeStore((s) => s.sidebarOpen);
  const setSidebarOpen = useNetScopeStore((s) => s.setSidebarOpen);
  const clearSession = useNetScopeStore((s) => s.clearSession);
  // Primitive selectors — component only re-renders when these specific values change,
  // not on every request addition/update.
  const hasSession = useNetScopeStore((s) => !!s.session);
  const totalCount = useNetScopeStore((s) => s.session?.requests.length ?? 0);
  const pendingCount = useNetScopeStore(
    (s) =>
      s.session?.requests.filter((r) => r.status === "pending").length ?? 0,
  );
  const errorCount = useNetScopeStore((s) => s.session?.errors.length ?? 0);
  const currentRoute = useNetScopeStore((s) => s.session?.currentRoute ?? "");

  const exportAll = () => {
    const session = useNetScopeStore.getState().session;
    if (!session) return;
    const blob = new Blob([JSON.stringify(session, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `netscope-report-${Date.now()}.json`;
    a.click();
  };

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed lg:relative z-30 lg:z-auto flex flex-col h-full bg-zinc-950 border-r border-zinc-800 transition-all duration-200",
          sidebarOpen ? "w-56" : "w-0 lg:w-12 overflow-hidden",
        )}
      >
        {/* Logo */}
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-4 border-b border-zinc-800",
            !sidebarOpen && "justify-center px-0",
          )}
        >
          <div className="h-6 w-6 rounded bg-blue-600 flex items-center justify-center shrink-0">
            <Activity className="h-3.5 w-3.5 text-white" />
          </div>
          {sidebarOpen && (
            <span className="font-semibold text-sm text-zinc-100">
              NetScope
            </span>
          )}
        </div>

        {/* Live counter */}
        {sidebarOpen && hasSession && (
          <div className="px-3 py-2 border-b border-zinc-800">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-500">Requests</span>
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-200 font-mono font-medium">
                  {totalCount}
                </span>
                {pendingCount > 0 && (
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                )}
              </div>
            </div>
            {currentRoute && (
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="text-zinc-500">Route</span>
                <span className="text-zinc-400 font-mono truncate max-w-[100px]">
                  {currentRoute}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Nav items */}
        <nav className="flex-1 py-2 space-y-0.5 px-1.5">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-sm transition-colors text-left",
                activeTab === id
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200",
                !sidebarOpen && "justify-center px-0",
              )}
              title={!sidebarOpen ? label : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {sidebarOpen && (
                <>
                  <span className="flex-1">{label}</span>
                  {id === "errors" && errorCount > 0 && (
                    <Badge
                      variant="destructive"
                      className="text-[10px] h-4 px-1"
                    >
                      {errorCount}
                    </Badge>
                  )}
                  {id === "network" && pendingCount > 0 && (
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                  )}
                </>
              )}
            </button>
          ))}
        </nav>

        <Separator />

        {/* Actions */}
        <div className="p-2 space-y-1">
          <button
            onClick={exportAll}
            className={cn(
              "w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-xs text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 transition-colors",
              !sidebarOpen && "justify-center",
            )}
            title={!sidebarOpen ? "Export report" : undefined}
          >
            <Download className="h-3.5 w-3.5 shrink-0" />
            {sidebarOpen && "Export report"}
          </button>

          <Link
            href="/"
            className={cn(
              "flex items-center gap-2.5 px-2 py-2 rounded-md text-xs text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 transition-colors",
              !sidebarOpen && "justify-center",
            )}
            title={!sidebarOpen ? "New session" : undefined}
          >
            <Home className="h-3.5 w-3.5 shrink-0" />
            {sidebarOpen && "New session"}
          </Link>

          <button
            onClick={clearSession}
            className={cn(
              "w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-xs text-red-500 hover:bg-red-950/40 hover:text-red-400 transition-colors",
              !sidebarOpen && "justify-center",
            )}
            title={!sidebarOpen ? "Clear data" : undefined}
          >
            <Trash2 className="h-3.5 w-3.5 shrink-0" />
            {sidebarOpen && "Clear data"}
          </button>
        </div>
      </aside>
    </>
  );
}

export function SidebarToggle() {
  const sidebarOpen = useNetScopeStore((s) => s.sidebarOpen);
  const setSidebarOpen = useNetScopeStore((s) => s.setSidebarOpen);
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={() => setSidebarOpen(!sidebarOpen)}
    >
      {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
    </Button>
  );
}
