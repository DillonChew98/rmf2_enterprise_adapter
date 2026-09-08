import type { LimsJob } from "@/entities/lims-job";
import type {
  ChemicalStep,
  DelayeringJobRequest,
  PortJob,
} from "./types";

// One process step, pre-filled by picking a recipe.
export function emptyStep(): ChemicalStep {
  return {
    recipeName: "",
    mode: 1, // single
    chemical: 0,
    components: [{ chemical: 0, percent: 0 }],
    method: 1, // NIL
    durationSec: 0,
  };
}

// The editable form for one port: a LIMS job + its recipe steps.
export interface PortForm {
  port: string;
  jobNumber: string;
  analysisType: string;
  submissionTime: string;
  limsStatus: string;
  stain: string | null;
  steps: ChemicalStep[];
}

export function emptyPort(port: string): PortForm {
  return {
    port,
    jobNumber: "",
    analysisType: "",
    submissionTime: "",
    limsStatus: "",
    stain: null,
    steps: [emptyStep()],
  };
}

// Fill a port's read-only LIMS fields from a selected LIMS job.
export function applyLimsToPort(p: PortForm, job: LimsJob): PortForm {
  return {
    ...p,
    jobNumber: job.jobNumber,
    analysisType: job.analysisType,
    submissionTime: job.submissionTime,
    limsStatus: job.status,
    stain: job.stain,
  };
}

function toFormStep(s: Partial<ChemicalStep> | undefined): ChemicalStep {
  const base = emptyStep();
  if (!s) return base;
  return {
    recipeName: s.recipeName ?? "",
    mode: s.mode ?? 1,
    chemical: s.chemical ?? 0,
    components:
      s.components && s.components.length > 0
        ? s.components.map((c) => ({ chemical: c.chemical ?? 0, percent: c.percent ?? 0 }))
        : base.components,
    method: s.method ?? 1,
    durationSec: s.durationSec ?? 0,
  };
}

// Turn a saved request's port jobs back into editable port forms (copy previous).
export function requestToPorts(req: DelayeringJobRequest): PortForm[] {
  const entries = Object.entries(req.jobs ?? {});
  if (entries.length === 0) return [emptyPort("1")];
  return entries.map(([port, j]) => ({
    port,
    jobNumber: j.jobNumber,
    // LIMS context isn't stored on the request; re-selecting the job refills it.
    analysisType: "",
    submissionTime: "",
    limsStatus: "",
    stain: j.stain,
    steps: j.steps.length ? j.steps.map(toFormStep) : [emptyStep()],
  }));
}

// Build the request (dict keyed by port) from the operator's port forms.
// jobOrder is the backend-assigned id obtained via `newJobOrder()`.
export function buildJobRequest(
  jobOrder: string,
  operatorName: string,
  ports: PortForm[]
): DelayeringJobRequest {
  const jobs: Record<string, PortJob> = {};
  for (const p of ports) {
    if (!p.jobNumber.trim()) continue;
    jobs[p.port] = {
      jobNumber: p.jobNumber,
      stain: p.stain,
      // Keep only the fields relevant to each step's mode.
      steps: p.steps
        .filter((s) => s.recipeName)
        .map((s) =>
          s.mode === 1 ? { ...s, components: [] } : { ...s, chemical: 0 }
        ),
    };
  }
  return {
    jobOrder,
    operatorName,
    jobs,
    submittedAt: new Date().toISOString(),
  };
}
