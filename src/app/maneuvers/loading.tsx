import { RefreshCw } from "lucide-react";

export default function Loading() {
  return (
    <div className="w-full space-y-6 select-none animate-pulse">
      <div className="flex items-center gap-4 border-b border-iron/40 pb-4">
        <div className="h-10 w-10 bg-iron/20 rounded-[4px]" />
        <div className="space-y-2">
          <div className="h-5 w-48 bg-iron/20 rounded-[3px]" />
          <div className="h-3 w-72 bg-iron/10 rounded-[3px]" />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-[#0c1222]/50 border border-iron/30 rounded-[6px]" />
        ))}
      </div>

      <div className="h-[400px] bg-[#0c1222]/50 border border-iron/30 rounded-[6px] flex items-center justify-center">
        <div className="flex flex-col items-center text-iron/40 gap-3">
          <RefreshCw className="h-6 w-6 animate-spin" />
          <span className="font-display text-[12px] uppercase tracking-widest font-semibold">Loading Module</span>
        </div>
      </div>
    </div>
  );
}
