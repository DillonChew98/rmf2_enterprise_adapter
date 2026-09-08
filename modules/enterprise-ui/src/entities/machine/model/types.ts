// Mirrors the RMF2 device `state`/`connection` topics for the delayering
// machine (deviceType: "machine"). These are exactly the fields the
// Dashboard renders.
//
// The machine interface now uses NUMERIC codes on the wire (previously string
// enums). The code tables are:
//   systemStatus:    1=IDLE, 2=RUNNING, 3=ERROR, 4=OFFLINE
//   step status:     1=PENDING, 2=ACTIVE, 3=DONE
//   sensor status:   1=OK, 2=FAULT, 3=OFFLINE
//   connectionState: 1=ONLINE, 2=OFFLINE, 3=CONNECTION_BROKEN
//   method:          1=NIL, 2=ULTRASONIC, 3=HEATED_PLATE

// 1=IDLE, 2=RUNNING, 3=ERROR, 4=OFFLINE
export type SystemStatus = number;

// 1=OK, 2=FAULT, 3=OFFLINE
export type SensorStatus = number;

// Derived by the FCS, never on the wire (see RMF2.0_Device_Interface §7.2.1).
// 1=ONLINE, 2=OFFLINE, 3=CONNECTION_BROKEN
export type ConnectionStatus = number;

// 1=PENDING, 2=ACTIVE, 3=DONE
export type ProcessStepStatus = number;

export interface Sensor {
  id: string;
  name: string;
  status: SensorStatus;
  value?: number;
  unit?: string;
}

// One chemical step of the running job's recipe, e.g.
// { chemical: 5, method: 1, durationSec: 240, status: 2 }.
export interface JobProcessStep {
  mode: number; // 1=single, 2=mix
  chemical: number; // single-chemical code (e.g. 5=BOE); 0 for a mix
  components: { chemical: number; percent: number }[]; // mix parts; [] for single
  method: number; // 1=NIL, 2=ULTRASONIC, 3=HEATED_PLATE
  durationSec: number; // total duration in seconds
  status: number; // 1=PENDING, 2=ACTIVE, 3=DONE
}

// A job the machine is running now (it can run several at once, one per port).
export interface CurrentJob {
  jobOrder: string; // "" for ambient (non-operator) jobs
  port: string;
  jobNumber: string;
  steps: JobProcessStep[];
}

// A job the machine has finished (newest first).
export interface CompletedJob {
  jobOrder: string;
  port: string;
  jobNumber: string;
  steps: JobProcessStep[];
  at: string; // ISO
}

export interface MachineState {
  systemStatus: SystemStatus;
  currentJobs: CurrentJob[]; // jobs running now (empty when idle)
  lastCompleted: CompletedJob[]; // finished jobs, newest first (capped)
  errorCode: string | null;
  sensors: Sensor[];
  chemicalStorage: number[]; // 8 cylinders, fill level 0-100%
}

export interface MachineConnection {
  status: ConnectionStatus;
  receivedAt: string | null;
}

// --- Display helpers: map numeric wire codes back to human labels ---

export function systemStatusLabel(code: number): string {
  switch (code) {
    case 1:
      return "Idle";
    case 2:
      return "Running";
    case 3:
      return "Error";
    case 4:
      return "Offline";
    default:
      return "Unknown";
  }
}

export function sensorStatusLabel(code: number): string {
  switch (code) {
    case 1:
      return "OK";
    case 2:
      return "Fault";
    case 3:
      return "Offline";
    default:
      return "Unknown";
  }
}

export function stepStatusLabel(code: number): string {
  switch (code) {
    case 1:
      return "Pending";
    case 2:
      return "Active";
    case 3:
      return "Done";
    default:
      return "Unknown";
  }
}

export function connectionStatusLabel(code: number): string {
  switch (code) {
    case 1:
      return "Online";
    case 2:
      return "Offline";
    case 3:
      return "Connection broken";
    default:
      return "Unknown";
  }
}

export function methodLabel(code: number): string {
  switch (code) {
    case 1:
      return "NIL";
    case 2:
      return "Ultrasonic";
    case 3:
      return "Heated plate";
    default:
      return "Unknown";
  }
}

// Human-readable duration from total seconds, e.g.
// 330 -> "5 min 30 sec", 60 -> "1 min", 5 -> "5 sec", 0 -> "0 sec".
export function formatDurationSec(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  const parts: string[] = [];
  if (m > 0) parts.push(`${m} min`);
  if (s > 0 || m === 0) parts.push(`${s} sec`);
  return parts.join(" ");
}
