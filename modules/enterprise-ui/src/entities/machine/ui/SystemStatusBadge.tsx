import { StatusBadge, type StatusTone } from "@/shared/ui/StatusBadge";
import { systemStatusLabel, type SystemStatus } from "../model/types";

// systemStatus: 1=IDLE, 2=RUNNING, 3=ERROR, 4=OFFLINE
const tone: Record<number, StatusTone> = {
  1: "neutral",
  2: "active",
  3: "danger",
  4: "neutral",
};

export function SystemStatusBadge({ status }: { status: SystemStatus }) {
  return (
    <StatusBadge tone={tone[status] ?? "neutral"} label={systemStatusLabel(status)} />
  );
}
