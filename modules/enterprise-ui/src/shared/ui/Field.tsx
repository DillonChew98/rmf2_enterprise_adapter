import type { ReactNode } from "react";

interface FieldProps {
  label: string;
  error?: string;
  children: ReactNode;
}

// Labelled wrapper for arbitrary controls (used where Input/Select's
// built-in label doesn't fit, e.g. inline mix-builder rows).
export function Field({ label, error, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
