import type {
  JobProcessStep,
  MachineConnection,
  MachineState,
  Sensor,
} from "../model/types";

// In-browser simulation of the delayering machine. A module-level interval
// advances a mutable snapshot once a second so the Dashboard's polling shows
// live movement. Swapped out wholesale when VITE_USE_MOCK=false.

interface RecipeStep {
  chemical: string;
  method: string;
  duration: string; // formatted incl. unit
}

// Per-job chemical recipes the machine works through. Modelled on the real
// delayering processes (BOE, mixes, poly etch, HF + ultrasonic, choline).
const RECIPES: Record<string, RecipeStep[]> = {
  "J-100482": [
    { chemical: "BOE", method: "NIL", duration: "2/1.5/1 min" },
    { chemical: "1:1 HCl+HNO3", method: "NIL", duration: "1 min" },
  ],
  "J-100483": [
    { chemical: "Poly etch (MAE)", method: "NIL", duration: "4 min" },
    { chemical: "HF", method: "Ultrasonic", duration: "5 sec" },
  ],
  "J-100484": [
    { chemical: "Choline hydroxide", method: "Heated plate", duration: "20-40 min" },
  ],
  "J-100485": [
    { chemical: "HF", method: "Ultrasonic", duration: "5 sec" },
    { chemical: "1:1 HCl+HNO3", method: "NIL", duration: "1 min" },
    { chemical: "BOE", method: "NIL", duration: "2/1.5/1 min" },
  ],
};

const JOB_QUEUE = Object.keys(RECIPES);
const PROCESS_TARGET = 60; // seconds of active chemistry per job
const CLEAN_TARGET = 78; // cycle second at which beaker cleaning finishes

// Build the step list with one ACTIVE step (or all DONE when finished/idle).
function buildSteps(recipe: RecipeStep[], activeIndex: number | null): JobProcessStep[] {
  return recipe.map((s, i) => ({
    ...s,
    status:
      activeIndex === null || i < activeIndex
        ? "DONE"
        : i === activeIndex
          ? "ACTIVE"
          : "PENDING",
  }));
}

function baseSensors(): Sensor[] {
  return [
    { id: "ultrasonic_unit", name: "Ultrasonic Overflow Sensor", status: "OK" },
    { id: "leak_detector", name: "Leak Detection Sensor", status: "OK" },
  ];
}

let jobIndex = 0;
let errorTicksLeft = 0;
let currentRecipe: RecipeStep[] = [];

const state: MachineState = {
  systemStatus: "IDLE",
  currentJob: null,
  currentJobSteps: [],
  lastCompletedJob: null,
  lastCompletedSteps: [],
  lastCompletedAt: null,
  completedJobs: [],
  cycleTimeSec: 0,
  errorCode: null,
  chemicalLevelStatus: "OK",
  processComplete: "NOT_STARTED",
  beakerCleaningStatus: "IDLE",
  alarmTriggered: false,
  alarmMessage: null,
  sensors: baseSensors(),
  chemicalStorage: [85, 62, 48, 33, 18, 8, 0, 55],
  beakerChemicals: [
    "BOE",
    "50%HCL; 50%HNO3",
    "MAE",
    "HF",
    "",
    "",
    "HF",
    "Choline hydroxide",
  ],
  jobDateTime: null,
  updatedAt: new Date().toISOString(),
};

const connection: MachineConnection = {
  status: "ONLINE",
  receivedAt: new Date().toISOString(),
};

function sensor(id: string): Sensor | undefined {
  return state.sensors.find((s) => s.id === id);
}

function setSensor(id: string, patch: Partial<Sensor>): void {
  const s = sensor(id);
  if (s) Object.assign(s, patch);
}

function startNextJob(): void {
  const jobNumber = JOB_QUEUE[jobIndex % JOB_QUEUE.length] ?? null;
  jobIndex += 1;
  state.currentJob = jobNumber;
  currentRecipe = jobNumber ? RECIPES[jobNumber] ?? [] : [];
  state.currentJobSteps = buildSteps(currentRecipe, 0);
  state.systemStatus = "RUNNING";
  state.cycleTimeSec = 0;
  state.processComplete = "IN_PROGRESS";
  state.beakerCleaningStatus = "IDLE";
  state.errorCode = null;
  state.alarmTriggered = false;
  state.alarmMessage = null;
  state.chemicalLevelStatus = "OK";
  state.sensors = baseSensors();
  setSensor("dispense_flow", { value: 1.4 });
  setSensor("bath_temp", { value: 55 });
  state.jobDateTime = new Date().toISOString();
}

function enterError(): void {
  errorTicksLeft = 8;
  state.systemStatus = "ERROR";
  state.errorCode = "E-204";
  state.alarmTriggered = true;
  state.alarmMessage = "Dispense over-pressure — chemistry paused";
  setSensor("leak_detector", { status: "TRIGGERED" });
  setSensor("dispense_flow", { value: 0, status: "FAULT" });
}

function clearError(): void {
  state.systemStatus = "RUNNING";
  state.errorCode = null;
  state.alarmTriggered = false;
  state.alarmMessage = null;
  setSensor("leak_detector", { status: "OK" });
  setSensor("dispense_flow", { value: 1.4, status: "OK" });
}

function tick(): void {
  if (state.systemStatus === "ERROR") {
    errorTicksLeft -= 1;
    if (errorTicksLeft <= 0) clearError();
    state.updatedAt = new Date().toISOString();
    return;
  }

  if (state.systemStatus === "IDLE") {
    // Brief idle pause, then pick up the next queued job.
    if (state.cycleTimeSec >= 5) {
      startNextJob();
    } else {
      state.cycleTimeSec += 1;
    }
    state.updatedAt = new Date().toISOString();
    return;
  }

  // RUNNING
  state.cycleTimeSec += 1;

  // Chemical storage drains only while a job runs.
  state.chemicalStorage = state.chemicalStorage.map((l) =>
    Math.max(0, l - 0.8)
  );

  // Occasional fault while actively processing.
  if (state.processComplete === "IN_PROGRESS" && Math.random() < 0.03) {
    enterError();
    state.updatedAt = new Date().toISOString();
    return;
  }

  // Advance the active chemical step across the processing window.
  if (state.processComplete === "IN_PROGRESS" && currentRecipe.length > 0) {
    const perStep = PROCESS_TARGET / currentRecipe.length;
    const idx = Math.min(
      currentRecipe.length - 1,
      Math.floor(state.cycleTimeSec / perStep)
    );
    state.currentJobSteps = buildSteps(currentRecipe, idx);
  }

  // Chemical level drains and bath temperature drifts during processing.
  const lvl = sensor("chem_level");
  if (lvl && typeof lvl.value === "number" && state.processComplete === "IN_PROGRESS") {
    lvl.value = Math.max(0, lvl.value - 1.3);
    state.chemicalLevelStatus =
      lvl.value > 40 ? "OK" : lvl.value > 15 ? "LOW" : lvl.value > 0 ? "CRITICAL" : "EMPTY";
    if (state.chemicalLevelStatus === "CRITICAL") {
      state.alarmTriggered = true;
      state.alarmMessage = "Chemical level critical";
    }
  }

  if (state.cycleTimeSec >= PROCESS_TARGET && state.processComplete === "IN_PROGRESS") {
    state.processComplete = "COMPLETE";
    state.beakerCleaningStatus = "CLEANING";
    state.currentJobSteps = buildSteps(currentRecipe, null);
    setSensor("dispense_flow", { value: 0 });
  }

  if (state.processComplete === "COMPLETE" && state.cycleTimeSec >= CLEAN_TARGET) {
    state.beakerCleaningStatus = "COMPLETE";
    state.systemStatus = "IDLE";
    state.cycleTimeSec = 0;
    // Record the finished job so the Pushed Job List can mark it COMPLETED.
    if (state.currentJob) {
      state.lastCompletedJob = state.currentJob;
      state.lastCompletedAt = new Date().toISOString();
      state.completedJobs = [
        state.currentJob,
        ...state.completedJobs.filter((n) => n !== state.currentJob),
      ].slice(0, 100);
    }
    state.currentJob = null;
    state.currentJobSteps = [];
    currentRecipe = [];
    state.jobDateTime = null;
    state.processComplete = "NOT_STARTED";
  }

  state.updatedAt = new Date().toISOString();
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
    currentJobSteps: state.currentJobSteps.map((s) => ({ ...s })),
    chemicalStorage: [...state.chemicalStorage],
    completedJobs: [...state.completedJobs],
  };
}

export function getMockMachineConnection(): MachineConnection {
  ensureStarted();
  return { ...connection, receivedAt: new Date().toISOString() };
}
