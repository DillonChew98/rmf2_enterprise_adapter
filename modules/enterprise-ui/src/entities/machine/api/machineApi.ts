import { api, USE_MOCK } from "@/shared/api/axios";
import type { MachineConnection, MachineState } from "../model/types";
import { getMockMachineConnection, getMockMachineState } from "../mock/machineSim";

// When VITE_USE_MOCK=false (default), machine status comes from the adapter,
// which reflects the real (mock) device over MQTT. When true, the UI runs the
// in-browser simulation standalone.
export async function getMachineState(): Promise<MachineState> {
  if (USE_MOCK) return getMockMachineState();
  const res = await api.get<MachineState>("/api/machine/state");
  return res.data;
}

export async function getMachineConnection(): Promise<MachineConnection> {
  if (USE_MOCK) return getMockMachineConnection();
  const res = await api.get<MachineConnection>("/api/machine/connection");
  return res.data;
}
