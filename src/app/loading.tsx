"use client";

import * as React from "react";
import { Loader2, Shield } from "lucide-react";

export default function Loading() {
  const [progress, setProgress] = React.useState(0);
  const [logIndex, setLogIndex] = React.useState(0);

  const logs = [
    "INITIATING SGP4 ORBITAL PROPAGATOR STATE...",
    "SYNCING LIVE TLE COORDINATES FROM CELESTRAK GP API...",
    "ESTABLISHING SERVER-SENT EVENTS TELEMETRY SOCKET...",
    "SCANNING 1,200 LOW EARTH ORBIT CO-ALIGNMENT TRACKS...",
    "RESOLVING ACTIVE COLLISION CONJUNCTION PATHWAYS...",
    "VERIFYING GROUND STATION CONTACT COMMUNICATIONS...",
    "SYNCHRONIZING SECURE AI OPERATOR HANDSHAKES...",
    "COMPILING OPERATIONAL DASHBOARD INSTRUMENTS..."
  ];

  React.useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 4;
      });
    }, 100);

    const logInterval = setInterval(() => {
      setLogIndex((prev) => (prev + 1) % logs.length);
    }, 800);

    return () => {
      clearInterval(progressInterval);
      clearInterval(logInterval);
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-[#000000] text-[#F0F0FA] flex flex-col items-center justify-center z-[9999] select-none font-sans">
      {/* Scanline background effect */}
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.005)_50%,rgba(0,0,0,0.25)_50%)] bg-[size:100%_4px] pointer-events-none" />

      <div className="w-full max-w-lg px-6 flex flex-col items-center space-y-8 relative">
        {/* Cinematic pulse badge */}
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-orbit-cyan/15 blur-md animate-ping" />
          <div className="h-16 w-16 rounded-full border border-orbit-cyan/35 bg-black/60 flex items-center justify-center text-orbit-cyan">
            <Shield className="h-7 w-7 animate-pulse" strokeWidth={1.5} />
          </div>
        </div>

        {/* Technical Title */}
        <div className="text-center space-y-2">
          <span className="text-[10px] font-display font-bold text-orbit-cyan uppercase tracking-[0.15em] block">
            System Initialization
          </span>
          <h1 className="font-display text-[20px] font-normal uppercase text-white tracking-widest leading-none">
            OrbitGuard Operations
          </h1>
        </div>

        {/* Futuristic Telemetry progress bar */}
        <div className="w-full space-y-3.5">
          <div className="flex justify-between font-mono text-[10px] text-white/50 uppercase tracking-wider">
            <span>Grid: LEO-160/2000KM</span>
            <span className="text-orbit-cyan font-bold">{progress}% LOADED</span>
          </div>

          <div className="h-1 w-full bg-white/5 border border-white/10 rounded-full overflow-hidden relative">
            <div
              className="h-full bg-orbit-cyan transition-all duration-100 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Running coordinates list logs */}
          <div className="h-6 overflow-hidden flex items-center justify-center">
            <span className="font-mono text-[10px] text-white/70 uppercase tracking-widest text-center animate-pulse">
              &gt; {logs[logIndex]}
            </span>
          </div>
        </div>

        {/* Small Spinner */}
        <div className="flex items-center space-x-2 text-white/30 text-[10px] font-display uppercase tracking-widest pt-4">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Synchronizing telemetry stream...</span>
        </div>
      </div>
    </div>
  );
}
