"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Zap, Activity, Network, Shield, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useNetScopeStore } from "@/store/useNetScopeStore";
import { isValidUrl, normalizeUrl } from "@/lib/utils";

const FEATURES = [
  {
    icon: Network,
    title: "Network Tracking",
    desc: "Monitor fetch, XHR, and resource requests in real time",
  },
  {
    icon: Activity,
    title: "Performance Vitals",
    desc: "TTFB, FCP, LCP, CLS, and INP metrics at a glance",
  },
  {
    icon: Globe,
    title: "Route Analytics",
    desc: "Per-page API call breakdown and load analysis",
  },
  {
    icon: Shield,
    title: "Error Detection",
    desc: "Catch uncaught exceptions, CORS failures, and rejections",
  },
  {
    icon: Zap,
    title: "Request Timeline",
    desc: "Waterfall visualization of all network activity",
  },
  {
    icon: Search,
    title: "Deep Filtering",
    desc: "Search, sort, and filter every captured request",
  },
];

const PRESETS = [
  "https://jsonplaceholder.typicode.com",
  "https://httpbin.org",
  "https://pokeapi.co",
];

export function LandingPage() {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const startSession = useNetScopeStore((s) => s.startSession);

  const handleStart = () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setError("Please enter a URL");
      return;
    }
    const normalized = normalizeUrl(trimmed);
    if (!isValidUrl(normalized)) {
      setError("Please enter a valid URL (e.g. https://example.com)");
      return;
    }
    setError("");
    startSession(normalized);
    router.push(`/simulator?url=${encodeURIComponent(normalized)}`);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center gap-3">
        <div className="h-7 w-7 rounded-md bg-blue-600 flex items-center justify-center">
          <Activity className="h-4 w-4 text-white" />
        </div>
        <span className="font-semibold text-zinc-100 tracking-tight">
          NetScope
        </span>
        <span className="ml-auto text-xs text-zinc-500">
          Session-only · No data stored
        </span>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20">
        <div className="max-w-2xl w-full text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-950 border border-blue-800 text-blue-400 text-xs font-medium mb-2">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
            Browser-based API performance simulator
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white">
            Inspect any website&apos;s{" "}
            <span className="text-blue-400">network activity</span>
          </h1>
          <p className="text-zinc-400 text-lg">
            Monitor API calls, performance vitals, route changes and errors —
            right inside your browser. Zero backend. Zero data stored after you
            close the tab.
          </p>

          {/* URL Input */}
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input
                className="pl-9 h-11 text-sm"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleStart()}
              />
            </div>
            <Button
              size="lg"
              className="h-11 px-6 bg-blue-600 hover:bg-blue-500 shrink-0"
              onClick={handleStart}
            >
              Start Simulation
              <Zap className="h-4 w-4" />
            </Button>
          </div>

          {error && <p className="text-sm text-red-400 text-left">{error}</p>}

          {/* Presets */}
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <span className="text-xs text-zinc-500">Try:</span>
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setUrl(p)}
                className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2"
              >
                {p.replace("https://", "")}
              </button>
            ))}
          </div>
        </div>

        {/* Limitation notice */}
        <div className="mt-12 max-w-2xl w-full">
          <div className="rounded-lg border border-yellow-900 bg-yellow-950/40 px-4 py-3 text-sm text-yellow-300/80">
            <span className="font-semibold text-yellow-300">Note: </span>
            NetScope can only track <strong>browser-visible requests</strong> —
            those made by JavaScript running in the page. Server-side or hidden
            backend calls are not visible to any browser tool.
          </div>
        </div>

        {/* Features grid */}
        <div className="mt-16 max-w-4xl w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <Card
              key={title}
              className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-colors"
            >
              <CardContent className="p-4 flex gap-3">
                <div className="h-8 w-8 rounded-md bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-100">{title}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      <footer className="border-t border-zinc-800 px-6 py-4 text-center text-xs text-zinc-600">
        NetScope · All data is session-only and cleared when this tab closes
      </footer>
    </div>
  );
}
