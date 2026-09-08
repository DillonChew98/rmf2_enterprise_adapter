import { useEffect } from "react";
import { cn } from "@/shared/lib/cn";

interface ToastProps {
  message: string;
  tone?: "success" | "error";
  onDismiss: () => void;
  duration?: number; // ms before auto-dismiss
}

// A transient corner notification that auto-dismisses. Self-contained (no global
// provider) — render it conditionally from the owning component's state.
export function Toast({
  message,
  tone = "success",
  onDismiss,
  duration = 4000,
}: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
    // Re-arm whenever the message changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message, duration]);

  return (
    <div className="fixed right-4 top-4 z-50">
      <div
        role="status"
        className={cn(
          "flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg",
          tone === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-rose-200 bg-rose-50 text-rose-800"
        )}
      >
        <span className="text-base font-bold">
          {tone === "success" ? "✓" : "!"}
        </span>
        <span className="text-sm font-medium">{message}</span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="ml-2 text-slate-400 hover:text-slate-600"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
