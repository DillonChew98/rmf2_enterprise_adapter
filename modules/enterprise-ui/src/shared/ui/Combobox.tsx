import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/shared/lib/cn";

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  label?: string;
  error?: string;
  placeholder?: string;
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  emptyText?: string;
}

// A searchable single-select: type to filter a long option list (e.g. LIMS job
// numbers), click or use arrow keys + Enter to pick, ✕ to clear.
export function Combobox({
  label,
  error,
  placeholder,
  options,
  value,
  onChange,
  disabled,
  emptyText = "No matches",
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  // Close when clicking outside.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Reset the highlighted row when the visible list changes.
  useEffect(() => setActive(0), [query, open]);

  function choose(opt: ComboboxOption) {
    onChange(opt.value);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[active];
      if (opt) choose(opt);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  }

  // Show the live query while open; otherwise the picked option's label.
  const inputValue = open ? query : selected?.label ?? "";

  return (
    <div className="flex flex-col gap-1" ref={rootRef}>
      {label && (
        <span className="text-sm font-medium text-slate-700">{label}</span>
      )}
      <div className="relative">
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full rounded-md border border-slate-300 bg-white px-3 py-2 pr-8 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-1 focus:ring-slate-900 disabled:bg-slate-100 disabled:text-slate-500",
            error && "border-rose-500 focus:border-rose-600 focus:ring-rose-600"
          )}
          placeholder={selected ? selected.label : placeholder}
          value={inputValue}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {selected && !disabled && (
          <button
            type="button"
            aria-label="Clear selection"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            onMouseDown={(e) => {
              e.preventDefault();
              onChange("");
              setQuery("");
            }}
          >
            ✕
          </button>
        )}
        {open && (
          <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-slate-400">{emptyText}</li>
            ) : (
              filtered.map((opt, i) => (
                <li
                  key={opt.value}
                  className={cn(
                    "cursor-pointer px-3 py-2 text-sm",
                    i === active
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-700",
                    opt.value === value && "font-medium"
                  )}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(opt);
                  }}
                >
                  {opt.label}
                </li>
              ))
            )}
          </ul>
        )}
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
