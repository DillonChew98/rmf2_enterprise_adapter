import { useFetch } from "@/shared/lib/hooks/useFetch";
import { StatusBadge, type StatusTone } from "@/shared/ui/StatusBadge";
import { formatTimestamp } from "@/shared/lib/formatTimestamp";
import { PushedJobList } from "@/entities/job-request";
import {
  ChemicalStoragePanel,
  CurrentJobPanel,
  connectionStatusLabel,
  getMachineConnection,
  getMachineState,
  SensorPanel,
  StatusGrid,
  type MachineConnection,
  type MachineState,
} from "@/entities/machine";

// connectionState: 1=ONLINE, 2=OFFLINE, 3=CONNECTION_BROKEN
const connectionTone: Record<number, StatusTone> = {
  1: "ok",
  2: "neutral",
  3: "danger",
};

export function DashboardPage() {
  const { state, refetch } = useFetch<MachineState>(getMachineState, {
    intervalMs: 1500,
  });
  const { state: conn } = useFetch<MachineConnection>(getMachineConnection, {
    intervalMs: 1500,
  });

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">
            System Status
          </h2>
          <p className="text-sm text-slate-500">
            Live status of the delayering machine.
          </p>
        </div>
        {conn.status === "ok" && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span>Machine</span>
            <StatusBadge
              tone={connectionTone[conn.data.status] ?? "neutral"}
              label={connectionStatusLabel(conn.data.status)}
            />
            {conn.data.receivedAt && (
              <span className="text-xs text-slate-400">
                {formatTimestamp(conn.data.receivedAt)}
              </span>
            )}
          </div>
        )}
      </div>

      {state.status === "loading" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-lg border border-slate-200 bg-white"
            />
          ))}
        </div>
      )}

      {state.status === "error" && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Failed to load machine status: {state.error}
          <button
            type="button"
            onClick={refetch}
            className="ml-2 underline underline-offset-2 hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {state.status === "ok" && (
        <div className="space-y-6">
          {/* Statuses on the left, current job on the right */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-6">
              <StatusGrid state={state.data} />
              <SensorPanel sensors={state.data.sensors} />
            </div>
            <CurrentJobPanel state={state.data} />
          </div>

          {/* Chemical storage cylinder fill levels */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
            <ChemicalStoragePanel levels={state.data.chemicalStorage} />
          </div>

          {/* All saved (pushed) jobs from the UI local store */}
          <PushedJobList completed={state.data.lastCompleted} />
        </div>
      )}
    </div>
  );
}
