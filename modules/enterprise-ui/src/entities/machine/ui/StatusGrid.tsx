import type { ReactNode } from "react";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import type { MachineState } from "../model/types";
import { SystemStatusBadge } from "./SystemStatusBadge";

function Tile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div className="mt-2 text-lg font-semibold text-slate-900">{children}</div>
    </div>
  );
}

export function StatusGrid({ state }: { state: MachineState }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Tile label="System Status">
          <SystemStatusBadge status={state.systemStatus} />
        </Tile>

        <Tile label="Error Code">
          {state.errorCode ? (
            <StatusBadge tone="danger" label={state.errorCode} />
          ) : (
            <span className="text-slate-400">None</span>
          )}
        </Tile>
      </div>
    </div>
  );
}
