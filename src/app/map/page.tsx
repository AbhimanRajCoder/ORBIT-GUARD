"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";

import { cn } from "@/lib/utils";

import { MapLoadingPlaceholder } from "@/components/dashboard/MapLoadingPlaceholder";

const EarthView = dynamic(() => import("@/components/EarthView"), {
  ssr: false,
  loading: () => <MapLoadingPlaceholder />
});

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
    <div className="relative w-full h-full bg-void overflow-hidden">
      {/* Full-Screen 3D Earth Visualizer */}
      <div className="absolute inset-0">
        <EarthView
          selectedObject={satParam || eventParam || null}
          compact={false}
        />
      </div>

      {/* ── Direct Telemetry HUD Overlays (Direct text overlays, no glassmorphic card chrome) ──────────────────── */}
      {showHUD && (
        <>
          {/* Top-Left: Title + Status */}
          <div className="absolute top-5 left-5 z-30 space-y-1">
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 rounded-full bg-[#98ff38] animate-pulse" />
              <span className="font-mono text-[10px] text-[#9c9c9c] uppercase tracking-widest">
                Live Orbital Awareness
              </span>
            </div>
            <h1 className="text-[26px] font-normal text-[#f3f3f3] uppercase tracking-wider font-sans">
              3D Orbit Map
            </h1>
          </div>

          {/* Bottom-Center: Time indicator */}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center space-x-4">
            <span className="font-mono text-[12px] text-[#f3f3f3]" suppressHydrationWarning>
              UTC: {new Date().toISOString().replace("T", " ").slice(0, 19)}
            </span>
            <span className="text-[12px] text-[#212121] font-mono">|</span>
            <span className="font-mono text-[11px] text-[#9c9c9c] uppercase tracking-wider">
              Sim Window: ±72h
            </span>
          </div>

          {/* Bottom-Right: Keyboard shortcut hint */}
          <div className="absolute bottom-5 right-5 z-30 flex items-center space-x-3">
            <button
              onClick={() => {
                if (!document.fullscreenElement) {
                  document.documentElement.requestFullscreen?.();
                } else {
                  document.exitFullscreen?.();
                }
              }}
              className="text-[#9c9c9c] hover:text-[#f3f3f3] transition-colors cursor-pointer border border-[#212121] bg-[#080808]/80 px-3 py-1.5 rounded-[8px] font-mono text-[11px] uppercase tracking-wider"
            >
              {isFullscreen ? "[MINIMIZE]" : "[FULLSCREEN]"}
            </button>
          </div>
        </>
      )}

      {/* Toggle HUD button (always visible) */}
      <button
        onClick={() => setShowHUD((v) => !v)}
        className="absolute top-5 right-5 z-30 bg-[#080808]/80 border border-[#212121] rounded-[8px] px-3 py-1.5 text-[#9c9c9c] hover:text-[#f3f3f3] transition-colors cursor-pointer font-mono text-[11px]"
        title="Toggle HUD (H)"
      >
        [HUD]
      </button>

      {/* ── Keyboard Shortcuts Modal (Gets standard card border treatment) ───────────────────── */}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#101010]/60 backdrop-blur-sm">
          <div
            className="absolute inset-0"
            onClick={() => setShowShortcuts(false)}
          />
          <div className="relative bg-[#080808] border border-[#212121] rounded-[8px] p-8 w-full max-w-sm space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[#212121] pb-3">
              <div className="flex items-center space-x-2">
                <span className="text-meta">
                  Keyboard Shortcuts
                </span>
              </div>
              <button
                onClick={() => setShowShortcuts(false)}
                className="px-2 py-1 border border-[#212121] hover:border-[#f3f3f3] text-[#9c9c9c] hover:text-[#f3f3f3] rounded-[8px] cursor-pointer transition-all font-mono text-[11px]"
              >
                [X]
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
                  <span className="text-[13px] text-[#9c9c9c]">
                    {desc}
                  </span>
                  <kbd className="px-2 py-0.5 bg-[#101010] border border-[#212121] rounded text-[11px] font-mono text-[#f3f3f3] min-w-[40px] text-center">
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
