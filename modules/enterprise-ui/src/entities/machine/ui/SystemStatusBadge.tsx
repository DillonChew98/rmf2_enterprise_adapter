import { StatusBadge, type StatusTone } from "@/shared/ui/StatusBadge";
import type { SystemStatus } from "../model/types";

const tone: Record<SystemStatus, StatusTone> = {
  IDLE: "neutral",
  RUNNING: "active",
  PAUSED: "warn",
  ERROR: "danger",
  MAINTENANCE: "info",
  OFFLINE: "neutral",
};

const label: Record<SystemStatus, string> = {
  IDLE: "Idle",
  RUNNING: "Running",
  PAUSED: "Paused",
  ERROR: "Error",
  MAINTENANCE: "Maintenance",
  OFFLINE: "Offline",
};

export function SystemStatusBadge({ status }: { status: SystemStatus }) {
  return <StatusBadge tone={tone[status]} label={label[status]} />;
}
