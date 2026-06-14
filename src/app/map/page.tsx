"use client";

import * as React from "react";
import EarthView from "@/components/EarthView";

export default function MapPage() {
  return (
    <div className="w-full h-[calc(100vh-112px)] select-none">
      <EarthView />
    </div>
  );
}
