"use client";

import * as React from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Topbar } from "@/components/dashboard/Topbar";
import { AlertBanner } from "@/components/dashboard/AlertBanner";
import { OnboardingModal } from "@/components/OnboardingModal";
import { WorkflowPipeline } from "@/components/dashboard/WorkflowPipeline";
import { useUI } from "@/lib/ui-context";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";
import { cn } from "@/lib/utils";

import { usePathname } from "next/navigation";
import { GuidedTour } from "@/components/dashboard/GuidedTour";

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const { sidebarMinimized } = useUI();
  const pathname = usePathname();
  useKeyboardShortcuts();

  if (pathname === "/") {
    return (
      <div className="min-h-screen w-full bg-void text-bone relative overflow-hidden flex flex-col">
        {children}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-void text-bone relative overflow-hidden">
      {/* Guided Tour Playbook Overlay */}
      <GuidedTour />

      {/* Onboarding Modal (shows on first visit) */}
      <OnboardingModal />

      {/* 1. Left Persistent Sidebar Navigation */}
      <Sidebar />
      
      {/* 2. Right Workspace Shell */}
      <div
        className={cn(
          "flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out",
          sidebarMinimized ? "pl-[64px]" : "pl-[240px]",
          // Mobile: no sidebar padding
          "max-md:pl-0"
        )}
      >
        {/* 3. Top Header Bar (56px high) */}
        <Topbar />
        
        {/* Alert Banner (Optional, shown if critical events exist) */}
        <AlertBanner />

        {/* 4. Page Main Content Area */}
        <main
          className={cn(
            "flex-1 pt-[56px]",
            pathname === "/map"
              ? "w-full h-[calc(100vh-56px)] overflow-hidden relative"
              : "p-6 max-md:p-3 max-w-[1440px] mx-auto w-full overflow-y-auto"
          )}
        >
          {pathname !== "/map" && <WorkflowPipeline />}
          {children}
        </main>
      </div>
    </div>
  );
}
