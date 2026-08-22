"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Layers, Clock, Keyboard, X, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

const EarthView = dynamic(() => import("@/components/EarthView"), { ssr: false });

function MapPageContent() {
  const searchParams = useSearchParams();
  const satParam = searchParams.get("sat");
  const eventParam = searchParams.get("event");

  const [showHUD, setShowHUD] = React.useState(true);
  const [showShortcuts, setShowShortcuts] = React.useState(false);
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key.toLowerCase()) {
        case "h":
          setShowHUD((v) => !v);
          break;
        case "?":
          setShowShortcuts((v) => !v);
          break;
        case "f":
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen?.();
            setIsFullscreen(true);
          } else {
            document.exitFullscreen?.();
            setIsFullscreen(false);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Sync fullscreen state
  React.useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  return (
    <div className="relative w-full h-[100vh] bg-void overflow-hidden -m-6 -mt-6" style={{ marginLeft: '-16rem', width: 'calc(100% + 16rem + 3rem)', marginTop: '-1.5rem', height: 'calc(100vh)' }}>
      {/* Full-Screen 3D Earth Visualizer */}
      <div className="absolute inset-0">
        <EarthView
          selectedObject={satParam || eventParam || null}
          compact={false}
        />
      </div>

      {/* ── Glassmorphic HUD Overlays ──────────────────── */}
      {showHUD && (
        <>
          {/* Top-Left: Title + Status */}
          <div className="absolute top-5 left-5 z-30 backdrop-blur-xl bg-void/40 border border-white/8 rounded-2xl px-5 py-3.5 space-y-1 shadow-2xl">
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 rounded-full bg-cleared-green animate-pulse" />
              <span className="font-mono text-[10px] text-ash/70 uppercase tracking-widest">
                Live Orbital Awareness
              </span>
            </div>
            <h1
              className="text-[26px] font-light text-cloud leading-none"
              style={{ fontFamily: "'Playfair Display', 'DM Serif Display', serif" }}
            >
              3D Orbit <em className="italic">Map</em>
            </h1>
          </div>

          {/* Bottom-Center: Time indicator */}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 backdrop-blur-xl bg-void/40 border border-white/8 rounded-2xl px-6 py-3 flex items-center space-x-4 shadow-2xl">
            <Clock className="h-4 w-4 text-orbit-cyan/70" />
            <span className="font-mono text-[11px] text-cloud" suppressHydrationWarning>
              {new Date().toISOString().replace("T", " ").slice(0, 19)} UTC
            </span>
            <span className="text-[10px] text-ash/50 font-mono">|</span>
            <span className="font-mono text-[10px] text-ash/60">
              Sim Window: ±72h
            </span>
          </div>

          {/* Bottom-Right: Keyboard shortcut hint */}
          <div className="absolute bottom-5 right-5 z-30 backdrop-blur-xl bg-void/40 border border-white/8 rounded-2xl px-4 py-2.5 flex items-center space-x-3 shadow-2xl">
            <button
              onClick={() => setShowShortcuts((v) => !v)}
              className="flex items-center space-x-1.5 text-ash/60 hover:text-cloud transition-colors cursor-pointer"
            >
              <Keyboard className="h-3.5 w-3.5" />
              <span className="font-mono text-[10px] uppercase tracking-wider">
                Shortcuts
              </span>
            </button>
            <span className="text-white/10">|</span>
            <button
              onClick={() => {
                if (!document.fullscreenElement) {
                  document.documentElement.requestFullscreen?.();
                } else {
                  document.exitFullscreen?.();
                }
              }}
              className="text-ash/60 hover:text-cloud transition-colors cursor-pointer"
            >
              {isFullscreen ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </>
      )}

      {/* Toggle HUD button (always visible) */}
      <button
        onClick={() => setShowHUD((v) => !v)}
        className="absolute top-5 right-5 z-30 backdrop-blur-xl bg-void/40 border border-white/8 rounded-xl p-2.5 text-ash/60 hover:text-cloud transition-colors cursor-pointer shadow-lg"
        title="Toggle HUD (H)"
      >
        <Layers className="h-4 w-4" />
      </button>

      {/* ── Keyboard Shortcuts Modal ───────────────────── */}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-void/60 backdrop-blur-sm">
          <div
            className="absolute inset-0"
            onClick={() => setShowShortcuts(false)}
          />
          <div className="relative backdrop-blur-2xl bg-graphite/80 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center space-x-2">
                <Keyboard className="h-4 w-4 text-orbit-cyan" />
                <span className="font-mono text-[11px] text-ash uppercase tracking-widest">
                  Keyboard Shortcuts
                </span>
              </div>
              <button
                onClick={() => setShowShortcuts(false)}
                className="p-1 border border-white/10 hover:border-white/20 text-ash hover:text-cloud rounded-lg cursor-pointer transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              {[
                { key: "H", desc: "Toggle HUD overlays" },
                { key: "F", desc: "Toggle fullscreen" },
                { key: "?", desc: "Show/hide shortcuts" },
                { key: "Space", desc: "Pause/resume animation" },
                { key: "R", desc: "Reset camera view" },
                { key: "Click", desc: "Select orbital object" },
                { key: "Scroll", desc: "Zoom in/out" },
                { key: "Drag", desc: "Rotate globe" },
              ].map(({ key, desc }) => (
                <div
                  key={key}
                  className="flex items-center justify-between"
                >
                  <span className="font-mono text-[11px] text-ash/80">
                    {desc}
                  </span>
                  <kbd className="px-2 py-0.5 bg-void/60 border border-white/10 rounded text-[10px] font-mono text-cloud min-w-[40px] text-center">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MapPage() {
  return (
    <React.Suspense
      fallback={
        <div className="w-full h-screen bg-void flex items-center justify-center">
          <span className="font-mono text-[11px] text-ash animate-pulse uppercase tracking-widest">
            Initializing Orbital Map…
          </span>
        </div>
      }
    >
      <MapPageContent />
    </React.Suspense>
  );
}
