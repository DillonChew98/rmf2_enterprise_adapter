// The RMF2 device `request` topic for the delayering machine — one work ORDER
// that loads several ports, each with its own LIMS job + recipe.

export const PROCESS_METHODS = ["ULTRASONIC", "HEATED_PLATE", "NIL"] as const;
export type ProcessMethod = (typeof PROCESS_METHODS)[number];
export const PROCESS_METHOD_LABELS: Record<ProcessMethod, string> = {
  ULTRASONIC: "Ultrasonic",
  HEATED_PLATE: "Heated plate",
  NIL: "NIL",
};

export const PORTS = ["1", "2", "3", "4"] as const;
export const MAX_STEPS = 5;
export const MAX_MIX_COMPONENTS = 3;

// Numeric mode on the wire: 1=single, 2=mix.
export type StepMode = number;

export interface MixComponent {
  chemical: number; // chemical code (1..8); 0 = none
  percent: number; // share of this chemical in the mix (0–100); components sum to 100
}

// One chemical process step — a snapshot of the recipe the operator picked.
// mode/method/chemical are NUMERIC wire codes (mode: 1=single, 2=mix; method:
// 1=NIL, 2=ULTRASONIC, 3=HEATED_PLATE; chemical: catalog code, 0 for a mix).
export interface ChemicalStep {
  recipeName: string; // the operator-defined recipe name
  mode: number; // 1=single, 2=mix
  chemical: number; // catalog code when mode === 1 (single); 0 for a mix
  components: MixComponent[]; // when mode === 2 (mix) (each with a % share; sum 100)
  method: number; // 1=NIL, 2=ULTRASONIC, 3=HEATED_PLATE
  durationSec: number; // total duration in seconds
}

// The job loaded on one port: a LIMS reference + the recipe steps to run.
// What actually goes to the machine for one port. LIMS-derived context
// (analysisType, submissionTime, limsStatus) is omitted — not a machine input.
export interface PortJob {
  jobNumber: string; // LIMS reference (may repeat across ports/orders)
  stain: string | null;
  steps: ChemicalStep[];
}

export interface DelayeringJobRequest {
  jobOrder: string; // unique work-order id (primary key), assigned on save
  operatorName: string;
  jobs: Record<string, PortJob>; // keyed by port number, e.g. "1", "2"
  submittedAt: string; // ISO, server-stamped
}
