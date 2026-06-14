"use client";

import { useEffect } from "react";
import { AlertOctagon, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("OrbitGuard Module Error:", error);
  }, [error]);

  return (
    <div className="h-[calc(100vh-100px)] w-full flex items-center justify-center select-none">
      <div className="max-w-md w-full bg-void border border-collision-red/45 rounded-md p-8 text-center space-y-5 animate-in slide-in-from-bottom-4">
        <div className="mx-auto w-12 h-12 bg-collision-red/10 rounded-full flex items-center justify-center">
          <AlertOctagon className="h-6 w-6 text-collision-red" strokeWidth={1.5} />
        </div>
        
        <div>
          <h2 className="font-display text-[16px] font-bold text-bone uppercase tracking-widest mb-2">
            Module Failure
          </h2>
          <p className="font-body text-[13px] text-ash">
            The telemetry pipeline or component rendering encountered an unexpected error.
          </p>
        </div>

        <div className="bg-void border border-iron rounded-md p-3 text-left overflow-hidden">
          <p className="font-data text-[10px] text-collision-red/80 break-all">
            {error.message || "Unknown rendering exception"}
          </p>
        </div>

        <Button 
          variant="ghost" 
          onClick={() => reset()}
          className="flex items-center gap-2 mx-auto"
        >
          <RefreshCcw className="h-4 w-4" />
          Attempt Recovery
        </Button>
      </div>
    </div>
  );
}
