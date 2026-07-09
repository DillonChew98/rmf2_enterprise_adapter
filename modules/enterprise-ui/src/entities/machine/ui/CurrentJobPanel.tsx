import { StatusBadge, type StatusTone } from "@/shared/ui/StatusBadge";
import { cn } from "@/shared/lib/cn";
import type { JobProcessStep, MachineState, ProcessStepStatus } from "../model/types";
import { SystemStatusBadge } from "./SystemStatusBadge";

const tone: Record<ProcessStepStatus, StatusTone> = {
  PENDING: "neutral",
  ACTIVE: "active",
  DONE: "ok",
};

const label: Record<ProcessStepStatus, string> = {
  PENDING: "Pending",
  ACTIVE: "Active",
  DONE: "Done",
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
            step.status === "ACTIVE"
              ? "border-indigo-200 bg-indigo-50"
              : "border-slate-200 bg-white"
          )}
        >
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-medium text-slate-400">{i + 1}.</span>
            <div>
              <p className="text-sm font-medium text-slate-900">
                {step.chemical}{" "}
                <span className="font-normal text-slate-500">
                  {step.duration}
                </span>
              </p>
              <p className="text-xs text-slate-500">{step.method}</p>
            </div>
          </div>
          <StatusBadge tone={tone[step.status]} label={label[step.status]} />
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

function CurrentTab({ state }: { state: MachineState }) {
  if (!state.currentJob) {
    return <p className="py-2 text-sm text-slate-400">No active job.</p>;
  }
  const steps = state.currentJobSteps;
  const activeIdx = steps.findIndex((s) => s.status === "ACTIVE");
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Job Number
          </p>
          <p className="text-base font-semibold text-slate-900">
            {state.currentJob}
          </p>
        </div>
        <SystemStatusBadge status={state.systemStatus} />
      </div>

      <div className="text-sm">
        <Info
          label="Process"
          value={
            activeIdx >= 0
              ? `step ${activeIdx + 1} of ${steps.length}`
              : `${steps.length} step(s)`
          }
        />
      </div>

      {state.errorCode && (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
          Error {state.errorCode}
        </p>
      )}

      <StepList steps={steps} />
    </div>
  );
}

export function CurrentJobPanel({ state }: { state: MachineState }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-3">
        <h3 className="text-sm font-semibold text-slate-900">Current Job</h3>
      </div>
      <div className="px-5 py-4">
        <CurrentTab state={state} />
      </div>
    </section>
  );
}
