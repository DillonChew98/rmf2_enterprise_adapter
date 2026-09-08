import { StatusBadge, type StatusTone } from "@/shared/ui/StatusBadge";
import { cn } from "@/shared/lib/cn";
import { formatMix } from "@/shared/lib/formatMix";
import { chemicalSymbol } from "@/shared/lib/chemicals";
import {
  formatDurationSec,
  methodLabel,
  stepStatusLabel,
  type JobProcessStep,
  type MachineState,
} from "../model/types";
import { SystemStatusBadge } from "./SystemStatusBadge";

// step status: 1=PENDING, 2=ACTIVE, 3=DONE
const tone: Record<number, StatusTone> = {
  1: "neutral",
  2: "active",
  3: "ok",
};

function StepList({ steps }: { steps: JobProcessStep[] }) {
  if (steps.length === 0)
    return <p className="py-2 text-sm text-slate-400">No steps.</p>;
  return (
    <ol className="space-y-2">
      {steps.map((step, i) => (
        <li
          key={i}
          className={cn(
            "flex items-center justify-between rounded-md border px-4 py-2.5",
            step.status === 2
              ? "border-indigo-200 bg-indigo-50"
              : "border-slate-200 bg-white"
          )}
        >
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-medium text-slate-400">{i + 1}.</span>
            <div>
              <p className="text-sm font-medium text-slate-900">
                {step.mode === 2 ? formatMix(step.components) : chemicalSymbol(step.chemical)}{" "}
                <span className="font-normal text-slate-500">
                  {formatDurationSec(step.durationSec)}
                </span>
              </p>
              <p className="text-xs text-slate-500">{methodLabel(step.method)}</p>
            </div>
          </div>
          <StatusBadge
            tone={tone[step.status] ?? "neutral"}
            label={stepStatusLabel(step.status)}
          />
        </li>
      ))}
    </ol>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-slate-500">{label}: </span>
      <span className="font-medium text-slate-800">{value}</span>
    </div>
  );
}

function CurrentJobs({ state }: { state: MachineState }) {
  const jobs = state.currentJobs;
  if (jobs.length === 0) {
    return <p className="py-2 text-sm text-slate-400">No active jobs.</p>;
  }
  return (
    <div className="space-y-5">
      {jobs.map((job, j) => {
        const activeIdx = job.steps.findIndex((s) => s.status === 2);
        return (
          <div key={job.jobOrder || `${job.jobNumber}-${j}`} className="space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Port {job.port || "—"}
                  {job.jobOrder ? ` · ${job.jobOrder}` : ""}
                </p>
                <p className="text-base font-semibold text-slate-900">
                  {job.jobNumber}
                </p>
              </div>
              <SystemStatusBadge status={state.systemStatus} />
            </div>

            <div className="text-sm">
              <Info
                label="Process"
                value={
                  activeIdx >= 0
                    ? `step ${activeIdx + 1} of ${job.steps.length}`
                    : `${job.steps.length} step(s)`
                }
              />
            </div>

            <StepList steps={job.steps} />
          </div>
        );
      })}
    </div>
  );
}

export function CurrentJobPanel({ state }: { state: MachineState }) {
  const count = state.currentJobs.length;
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <h3 className="text-sm font-semibold text-slate-900">
          Current Jobs{count > 1 ? ` (${count})` : ""}
        </h3>
        {state.errorCode && (
          <span className="rounded bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
            Error {state.errorCode}
          </span>
        )}
      </div>
      <div className="px-5 py-4">
        <CurrentJobs state={state} />
      </div>
    </section>
  );
}
