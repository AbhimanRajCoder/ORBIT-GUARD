import Link from "next/link";
import { Compass, Home } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4 select-none">
      <div className="p-4 rounded-full bg-collision-red/10 border border-collision-red/20 text-collision-red mb-6 animate-pulse">
        <Compass className="h-12 w-12" strokeWidth={1.2} />
      </div>
      <h1 className="font-display text-[48px] font-bold text-bone tracking-wider leading-none">
        404
      </h1>
      <h2 className="font-display text-[12px] font-semibold text-ash uppercase tracking-widest mt-3">
        ORBITAL STATE UNRESOLVED
      </h2>
      <p className="font-body text-[13px] text-graphite mt-4 max-w-sm leading-relaxed">
        The coordinates or trajectory you requested do not exist in the active tracking catalog. The object may have decayed or reentered the atmosphere.
      </p>
      <div className="mt-8">
        <Link href="/dashboard">
          <Button variant="primary" className="flex items-center space-x-2 py-2 px-5 font-display text-[11px] font-semibold uppercase tracking-wider">
            <Home className="h-4 w-4" />
            <span>Return to Mission Control</span>
          </Button>
        </Link>
      </div>
    </div>
  );
}
