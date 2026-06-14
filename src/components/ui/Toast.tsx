"use client";

import * as React from "react";
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/lib/toast-context";
import { ToastType } from "@/lib/toast-context";

const TOAST_ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 text-cleared-green" />,
  error: <XCircle className="h-4 w-4 text-collision-red" />,
  warning: <AlertTriangle className="h-4 w-4 text-threat-amber" />,
  info: <Info className="h-4 w-4 text-orbit-cyan" />,
};

const TOAST_BORDERS: Record<ToastType, string> = {
  success: "border-cleared-green/40",
  error: "border-collision-red/40",
  warning: "border-threat-amber/40",
  info: "border-orbit-cyan/40",
};

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "pointer-events-auto flex items-center gap-3 bg-[#0a0e1a] border rounded-[6px] px-4 py-3 shadow-xl min-w-[300px] max-w-[400px] animate-in slide-in-from-bottom-5 fade-in duration-300",
            TOAST_BORDERS[toast.type]
          )}
        >
          <div className="shrink-0">{TOAST_ICONS[toast.type]}</div>
          <div className="flex-1 min-w-0">
            <p className="font-body text-[13px] text-bone leading-tight">
              {toast.message}
            </p>
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="shrink-0 text-ash hover:text-bone transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
