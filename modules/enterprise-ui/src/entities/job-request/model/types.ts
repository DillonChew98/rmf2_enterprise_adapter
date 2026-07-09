// The RMF2 device `request` topic for the delayering machine — a job to run.
// A job is exactly ONE of three mutually-exclusive types. LIMS-derived fields
// are pre-filled read-only; the rest is operator-supplied.

export const PROCESS_METHODS = ["ULTRASONIC", "HEATED_PLATE", "NIL"] as const;
export type ProcessMethod = (typeof PROCESS_METHODS)[number];
export const PROCESS_METHOD_LABELS: Record<ProcessMethod, string> = {
  ULTRASONIC: "Ultrasonic",
  HEATED_PLATE: "Heated plate",
  NIL: "NIL",
};

export const JOB_TYPES = ["CHEMICAL_PROCESS"] as const;
export type JobType = (typeof JOB_TYPES)[number];
export const JOB_TYPE_LABELS: Record<JobType, string> = {
  CHEMICAL_PROCESS: "Chemical Process",
};

export const MAX_STEPS = 5;
export const MAX_MIX_COMPONENTS = 3;

export type StepMode = "single" | "mix";

export interface MixComponent {
  chemical: string;
  parts: number; // ratio numerator, e.g. 1:1 -> [1, 1]
}

// One chemical process step — a snapshot of the recipe the operator picked.
export interface ChemicalStep {
  recipeName: string; // which recipe was chosen (the auto-label)
  mode: StepMode;
  chemical: string; // when mode === "single"
  components: MixComponent[]; // when mode === "mix" (parts = % summing to 100)
  method: ProcessMethod;
  durationMin: string;
  durationSec: string;
}

interface JobBase {
  // LIMS-derived (read-only)
  jobNumber: string;
  analysisType: string;
  submissionTime: string;
  limsStatus: string;
  stain: string | null;
  // operator-supplemented (common to every job type)
  operatorName: string;
  loadports: string[]; // selected loadports, e.g. ["1","3"]
  submittedAt: string; // ISO, server-stamped
}

export type DelayeringJobRequest = JobBase & {
  jobType: "CHEMICAL_PROCESS";
  steps: ChemicalStep[];
};
