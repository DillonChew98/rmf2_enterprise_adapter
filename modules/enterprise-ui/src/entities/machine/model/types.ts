// Mirrors the RMF2 device `state`/`connection` topics for the delayering
// machine (deviceType: "machine"). These are exactly the fields the
// Dashboard renders.

export type SystemStatus =
  | "IDLE"
  | "RUNNING"
  | "PAUSED"
  | "ERROR"
  | "MAINTENANCE"
  | "OFFLINE";

export type LevelStatus = "OK" | "LOW" | "CRITICAL" | "EMPTY";

export type ProcessStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE";

export type CleaningStatus = "IDLE" | "CLEANING" | "COMPLETE" | "FAULT";

export type SensorStatus = "OK" | "TRIGGERED" | "FAULT" | "OFFLINE";

// Derived by the FCS, never on the wire (see RMF2.0_Device_Interface §7.2.1).
export type ConnectionStatus = "ONLINE" | "OFFLINE" | "CONNECTION_BROKEN";

export interface Sensor {
  id: string;
  name: string;
  status: SensorStatus;
  value?: number;
  unit?: string;
}

export type ProcessStepStatus = "PENDING" | "ACTIVE" | "DONE";

// One chemical step of the running job's recipe, e.g.
// { chemical: "BOE", method: "Etching", duration: "2/1.5/1 min" }.
export interface JobProcessStep {
  chemical: string; // "BOE" or a mix like "1:1 HCl+HNO3"
  method: string; // "Ultrasonic" | "Heated plate" | "Etching"
  duration: string; // formatted incl. unit, e.g. "4 min", "5 sec"
  status: ProcessStepStatus;
}

export interface MachineState {
  systemStatus: SystemStatus;
  currentJob: string | null;
  currentJobSteps: JobProcessStep[]; // recipe of the running job (empty when idle)
  lastCompletedJob: string | null; // last finished job (shown when idle)
  lastCompletedSteps: JobProcessStep[];
  lastCompletedAt: string | null; // ISO
  completedJobs: string[]; // every job number the machine has finished (newest first)
  cycleTimeSec: number;
  errorCode: string | null;
  chemicalLevelStatus: LevelStatus;
  processComplete: ProcessStatus;
  beakerCleaningStatus: CleaningStatus;
  alarmTriggered: boolean;
  alarmMessage: string | null;
  sensors: Sensor[];
  chemicalStorage: number[]; // 8 cylinders, fill level 0-100%
  beakerChemicals: string[]; // chemical loaded in each beaker 1-8 ("" = empty)
  jobDateTime: string | null; // ISO; when the current job started
  updatedAt: string; // ISO; last state publish time
}

export interface MachineConnection {
  status: ConnectionStatus;
  receivedAt: string | null;
}
