import { z } from "zod";
import type { LimsJob } from "@/entities/lims-job";
import {
  JOB_TYPES,
  MAX_STEPS,
  PROCESS_METHODS,
  type ChemicalStep,
  type DelayeringJobRequest,
} from "./types";

const methodSchema = z.enum(PROCESS_METHODS);

const mixComponentSchema = z.object({
  chemical: z.string(),
  parts: z.number({ invalid_type_error: "Parts must be a number" }),
});

const stepSchema = z.object({
  recipeName: z.string(),
  mode: z.enum(["single", "mix"]),
  chemical: z.string(),
  components: z.array(mixComponentSchema),
  method: methodSchema,
  durationMin: z.string(),
  durationSec: z.string(),
});

// All branches are kept present so react-hook-form has stable fields;
// `jobType` selects which branch is required & validated. Mutual exclusivity
// falls out — only the active branch is validated and submitted.
export const jobFormSchema = z
  .object({
    // LIMS-derived
    jobNumber: z.string().min(1, "Look up a LIMS job first"),
    analysisType: z.string(),
    submissionTime: z.string(),
    limsStatus: z.string(),
    stain: z.string().nullable(),
    // operator common
    operatorName: z.string().min(1, "Operator name is required"),
    loadports: z.array(z.string()).min(1, "Select at least one loadport"),
    jobType: z.enum(JOB_TYPES),
    // chemical process
    steps: z.array(stepSchema),
  })
  .superRefine((v, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: "custom", path, message });

    if (v.steps.length < 1) issue(["steps"], "Add at least one step");
    if (v.steps.length > MAX_STEPS) issue(["steps"], `Max ${MAX_STEPS} steps`);
    v.steps.forEach((s, i) => {
      if (!s.recipeName) issue(["steps", i, "recipeName"], "Pick a recipe");
    });
  });

export type JobFormValues = z.infer<typeof jobFormSchema>;

export function emptyStep(): ChemicalStep {
  return {
    recipeName: "",
    mode: "single",
    chemical: "",
    components: [{ chemical: "", parts: 100 }],
    method: "NIL",
    durationMin: "",
    durationSec: "",
  };
}

export function emptyJobForm(): JobFormValues {
  return {
    jobNumber: "",
    analysisType: "",
    submissionTime: "",
    limsStatus: "",
    stain: null,
    operatorName: "",
    loadports: [],
    jobType: "CHEMICAL_PROCESS",
    steps: [emptyStep()],
  };
}

// Overlay a selected LIMS job's read-only fields onto the form.
export function applyLimsJob(values: JobFormValues, job: LimsJob): JobFormValues {
  return {
    ...values,
    jobNumber: job.jobNumber,
    analysisType: job.analysisType,
    submissionTime: job.submissionTime,
    limsStatus: job.status,
    stain: job.stain,
  };
}

// Normalize a server/previous step into the full form shape.
function toFormStep(s: Partial<ChemicalStep> | undefined): ChemicalStep {
  const base = emptyStep();
  if (!s) return base;
  return {
    recipeName: s.recipeName ?? "",
    mode: s.mode ?? "single",
    chemical: s.chemical ?? "",
    components:
      s.components && s.components.length > 0
        ? s.components.map((c) => ({ chemical: c.chemical, parts: c.parts }))
        : base.components,
    method: s.method ?? "NIL",
    durationMin: s.durationMin ?? "",
    durationSec: s.durationSec ?? "",
  };
}

// Copy a previous job's operator fields into the form, leaving the currently
// selected LIMS job in place.
export function applyPreviousJob(
  values: JobFormValues,
  prev: DelayeringJobRequest
): JobFormValues {
  const next: JobFormValues = {
    ...values,
    operatorName: prev.operatorName,
    loadports: prev.loadports,
    jobType: prev.jobType,
    steps: prev.steps?.length ? prev.steps.map(toFormStep) : [emptyStep()],
  };
  return next;
}

// Map validated form values to the discriminated domain request.
export function toJobRequest(v: JobFormValues): DelayeringJobRequest {
  const base = {
    jobNumber: v.jobNumber,
    analysisType: v.analysisType,
    submissionTime: v.submissionTime,
    limsStatus: v.limsStatus,
    stain: v.stain,
    operatorName: v.operatorName,
    loadports: v.loadports,
    submittedAt: new Date().toISOString(),
  };

  // Keep only the fields relevant to each step's mode.
  const steps: ChemicalStep[] = v.steps.map((s) =>
    s.mode === "single" ? { ...s, components: [] } : { ...s, chemical: "" }
  );
  return { ...base, jobType: "CHEMICAL_PROCESS", steps };
}
