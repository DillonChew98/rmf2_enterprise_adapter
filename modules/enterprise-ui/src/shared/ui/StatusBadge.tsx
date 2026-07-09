import { cn } from "@/shared/lib/cn";

// Semantic tones used across the dashboard. `active` reads as "in motion",
// distinct from the steady-good `ok`.
export type StatusTone =
  | "ok"
  | "active"
  | "warn"
  | "danger"
  | "info"
  | "neutral";

interface StatusBadgeProps {
  tone: StatusTone;
  label: string;
  className?: string;
}

const toneClass: Record<StatusTone, string> = {
  ok: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  active: "bg-indigo-100 text-indigo-800 ring-indigo-200",
  warn: "bg-amber-100 text-amber-800 ring-amber-200",
  danger: "bg-rose-100 text-rose-800 ring-rose-200",
  info: "bg-sky-100 text-sky-800 ring-sky-200",
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
};

export function StatusBadge({ tone, label, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        toneClass[tone],
        className
      )}
    >
      {label}
    </span>
  );
}
