"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

const ROUTES: Record<string, string> = {
  "1": "/dashboard",
  "2": "/conjunctions",
  "3": "/maneuvers",
  "4": "/ai-briefing",
  "5": "/map",
};

/**
 * Global keyboard shortcuts for OrbitGuard:
 *
 * Ctrl+K / Cmd+K  → Focus the search bar
 * 1-7             → Navigate to pages (when not typing in an input)
 * ?               → Re-show the onboarding modal
 */
export function useKeyboardShortcuts() {
  const router = useRouter();

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;

      // Ctrl+K or Cmd+K → focus search bar
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>(
          'input[placeholder*="Search"]'
        );
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
        return;
      }

      // Skip number shortcuts if user is typing in an input
      if (isInput) return;

      // Number keys 1-7 → navigate
      if (ROUTES[e.key]) {
        e.preventDefault();
        router.push(ROUTES[e.key]);
        return;
      }

      // ? → re-show onboarding
      if (e.key === "?") {
        e.preventDefault();
        localStorage.removeItem("orbitguard-onboarding-seen");
        window.location.reload();
        return;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [router]);
}
