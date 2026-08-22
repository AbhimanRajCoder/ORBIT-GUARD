"use client";

import * as React from "react";
import { Loader2, Globe } from "lucide-react";

export function MapLoadingPlaceholder() {
  return (
    <div className="w-full h-full min-h-[400px] bg-void/95 border border-iron/20 rounded-2xl flex flex-col items-center justify-center space-y-5 select-none relative overflow-hidden animate-in fade-in duration-300">
      {/* High-tech grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,179,221,0.03)_0%,transparent_70%)] pointer-events-none" />

      {/* Pulsing icon */}
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-orbit-cyan/10 blur-xl animate-pulse" />
        <div className="h-14 w-14 rounded-full border border-orbit-cyan/20 bg-abyss flex items-center justify-center text-orbit-cyan animate-pulse">
          <Globe className="h-6 w-6 animate-spin [animation-duration:10s]" />
        </div>
      </div>

      {/* Status log */}
      <div className="text-center space-y-2.5 z-10">
        <span className="font-display text-[9px] font-bold text-orbit-cyan uppercase tracking-[0.2em] block">
          Loading 3D Visualizer
        </span>
        <h3 className="font-display text-[14px] font-normal uppercase text-bone tracking-widest">
          Mounting Space Catalog
        </h3>
        <div className="flex items-center justify-center space-x-2 text-[10px] text-ash/60 font-data">
          <Loader2 className="h-3 w-3 animate-spin text-orbit-cyan" />
          <span>Compiling WebGL shaders & loading TLE orbits...</span>
        </div>
      </div>
    </div>
  );
}
