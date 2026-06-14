"use client";

import * as React from "react";

interface UIContextType {
  sidebarMinimized: boolean;
  toggleSidebar: () => void;
}

const UIContext = React.createContext<UIContextType | undefined>(undefined);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [sidebarMinimized, setSidebarMinimized] = React.useState(false);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("sidebar-minimized");
      if (stored === "true") {
        setSidebarMinimized(true);
      }
    }
  }, []);

  const toggleSidebar = () => {
    setSidebarMinimized((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-minimized", String(next));
      return next;
    });
  };

  return (
    <UIContext.Provider value={{ sidebarMinimized, toggleSidebar }}>
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  const context = React.useContext(UIContext);
  if (!context) {
    throw new Error("useUI must be used within a UIProvider");
  }
  return context;
}
