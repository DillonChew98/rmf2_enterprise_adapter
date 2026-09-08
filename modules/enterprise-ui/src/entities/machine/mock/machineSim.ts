import type {
  JobProcessStep,
  MachineConnection,
  MachineState,
  Sensor,
} from "../model/types";

// In-browser simulation of the delayering machine. A module-level interval
// advances a mutable snapshot once a second so the Dashboard's polling shows
// live movement. Swapped out wholesale when VITE_USE_MOCK=false.
//
// The machine interface uses NUMERIC codes on the wire:
//   systemStatus:  1=IDLE, 2=RUNNING, 3=ERROR, 4=OFFLINE
//   step status:   1=PENDING, 2=ACTIVE, 3=DONE
//   sensor status: 1=OK, 2=FAULT, 3=OFFLINE
//   connection:    1=ONLINE, 2=OFFLINE, 3=CONNECTION_BROKEN
//   method:        1=NIL, 2=ULTRASONIC, 3=HEATED_PLATE

interface RecipeStep {
  mode: number; // 1=single, 2=mix
  chemical: number; // 0 for a mix (chemical code otherwise)
  components: { chemical: number; percent: number }[]; // [] for a single chemical
  method: number; // 1=NIL, 2=ULTRASONIC, 3=HEATED_PLATE
  durationSec: number;
}

// Chemical codes (fixed catalog): 1=HNO3, 2=HF, 3=HCl, 4=MAE, 5=BOE, 6=Choline.
// Per-job chemical recipes the machine works through. Modelled on the real
// delayering processes (BOE, mixes, poly etch, HF + ultrasonic, choline).
// Convenience builders keep each recipe step readable.
function single(chemical: number, method: number, durationSec: number): RecipeStep {
  return { mode: 1, chemical, components: [], method, durationSec };
}
function mix(
  components: { chemical: number; percent: number }[],
  method: number,
  durationSec: number
): RecipeStep {
  return { mode: 2, chemical: 0, components, method, durationSec };
}

const HCL_HNO3 = [
  { chemical: 3, percent: 50 }, // HCl
  { chemical: 1, percent: 50 }, // HNO3
];

const RECIPES: Record<string, RecipeStep[]> = {
  "J-100482": [
    single(5, 1, 270), // BOE
    mix(HCL_HNO3, 1, 60),
  ],
  "J-100483": [
    single(4, 1, 240), // MAE (poly etch)
    single(2, 2, 5), // HF
  ],
  "J-100484": [
    single(6, 3, 1800), // Choline
  ],
  "J-100485": [
    single(2, 2, 5), // HF
    mix(HCL_HNO3, 1, 60),
    single(5, 1, 270), // BOE
  ],
};

const JOB_QUEUE = Object.keys(RECIPES);
const PROCESS_TARGET = 60; // seconds of active chemistry per job
const CLEAN_TARGET = 78; // cycle second at which the job fully finishes

// Build the step list with one ACTIVE step (or all DONE when finished/idle).
function buildSteps(recipe: RecipeStep[], activeIndex: number | null): JobProcessStep[] {
  return recipe.map((s, i) => ({
    ...s,
    status:
      activeIndex === null || i < activeIndex
        ? 3 // DONE
        : i === activeIndex
          ? 2 // ACTIVE
          : 1, // PENDING
  }));
}

function baseSensors(): Sensor[] {
  return [
    { id: "ultrasonic_unit", name: "Ultrasonic Overflow Sensor", status: 1 },
    { id: "leak_detector", name: "Leak Detection Sensor", status: 1 },
  ];
}

// Internal simulation state — NOT part of the published MachineState.
let jobIndex = 0;
let errorTicksLeft = 0;
let currentRecipe: RecipeStep[] = [];
let cycleTimeSec = 0;
let processing = false; // true while actively running chemistry (pre-finish)

const state: MachineState = {
  systemStatus: 1, // IDLE
  currentJobs: [],
  lastCompleted: [],
  errorCode: null,
  sensors: baseSensors(),
  chemicalStorage: [85, 62, 48, 33, 18, 8, 0, 55],
};

const connection: MachineConnection = {
  status: 1, // ONLINE
  receivedAt: new Date().toISOString(),
};

function setSensor(id: string, patch: Partial<Sensor>): void {
  const s = state.sensors.find((x) => x.id === id);
  if (s) Object.assign(s, patch);
}

function startNextJob(): void {
  const jobNumber = JOB_QUEUE[jobIndex % JOB_QUEUE.length] ?? null;
  jobIndex += 1;
  currentRecipe = jobNumber ? RECIPES[jobNumber] ?? [] : [];
  // The mock runs one job at a time; the field is a list so the real machine
  // can report several concurrent jobs.
  state.currentJobs = jobNumber
    ? [{ jobOrder: "", port: String((jobIndex % 4) + 1), jobNumber, steps: buildSteps(currentRecipe, 0) }]
    : [];
  state.systemStatus = 2; // RUNNING
  cycleTimeSec = 0;
  processing = true;
  state.errorCode = null;
  state.sensors = baseSensors();
}

function enterError(): void {
  errorTicksLeft = 8;
  state.systemStatus = 3; // ERROR
  state.errorCode = "E-204";
  setSensor("leak_detector", { status: 2 }); // FAULT
}

function clearError(): void {
  state.systemStatus = 2; // RUNNING
  state.errorCode = null;
  setSensor("leak_detector", { status: 1 }); // OK
}

function tick(): void {
  if (state.systemStatus === 3) {
    // ERROR
    errorTicksLeft -= 1;
    if (errorTicksLeft <= 0) clearError();
    return;
  }

  if (state.systemStatus === 1) {
    // IDLE — brief idle pause, then pick up the next queued job.
    if (cycleTimeSec >= 5) startNextJob();
    else cycleTimeSec += 1;
    return;
  }

  // RUNNING
  cycleTimeSec += 1;

  // Chemical storage drains only while a job runs.
  state.chemicalStorage = state.chemicalStorage.map((l) => Math.max(0, l - 0.8));

  // Occasional fault while actively processing.
  if (processing && Math.random() < 0.03) {
    enterError();
    return;
  }

  const job = state.currentJobs[0];

  // Advance the active chemical step across the processing window.
  if (processing && currentRecipe.length > 0 && job) {
    const perStep = PROCESS_TARGET / currentRecipe.length;
    const idx = Math.min(
      currentRecipe.length - 1,
      Math.floor(cycleTimeSec / perStep)
    );
    job.steps = buildSteps(currentRecipe, idx);
  }

  if (cycleTimeSec >= PROCESS_TARGET && processing) {
    processing = false;
    if (job) job.steps = buildSteps(currentRecipe, null);
  }

  if (!processing && cycleTimeSec >= CLEAN_TARGET) {
    state.systemStatus = 1; // IDLE
    cycleTimeSec = 0;
    // Record the finished job so the Pushed Job List can mark it COMPLETED.
    if (job) {
      state.lastCompleted = [
        { ...job, at: new Date().toISOString() },
        ...state.lastCompleted,
      ].slice(0, 200);
    }
    state.currentJobs = [];
    currentRecipe = [];
  }
}

let started = false;
function ensureStarted(): void {
  if (started) return;
  started = true;
  startNextJob();
  setInterval(tick, 1000);
}

export function getMockMachineState(): MachineState {
  ensureStarted();
  // Return a clone so consumers can't mutate the live snapshot.
  return {
    ...state,
    sensors: state.sensors.map((s) => ({ ...s })),
    currentJobs: state.currentJobs.map((j) => ({
      ...j,
      steps: j.steps.map((s) => ({ ...s })),
    })),
    lastCompleted: state.lastCompleted.map((c) => ({
      ...c,
      steps: c.steps.map((s) => ({ ...s })),
    })),
    chemicalStorage: [...state.chemicalStorage],
  };
}

export function getMockMachineConnection(): MachineConnection {
  ensureStarted();
  return { ...connection, receivedAt: new Date().toISOString() };
}
