import { Card } from "@/shared/ui/Card";
import { StatusBadge, type StatusTone } from "@/shared/ui/StatusBadge";
import type { Sensor, SensorStatus } from "../model/types";

// Sensors are shown as a simple On/Off indicator.
const tone: Record<SensorStatus, StatusTone> = {
  OK: "ok",
  TRIGGERED: "ok",
  FAULT: "danger",
  OFFLINE: "neutral",
};

const label: Record<SensorStatus, string> = {
  OK: "On",
  TRIGGERED: "On",
  FAULT: "Off",
  OFFLINE: "Off",
};

export function SensorPanel({ sensors }: { sensors: Sensor[] }) {
  return (
    <Card title="Sensors">
      <ul className="divide-y divide-slate-100">
        {sensors.map((s) => (
          <li key={s.id} className="flex items-center justify-between py-2.5">
            <div>
              <p className="text-sm font-medium text-slate-800">{s.name}</p>
              {typeof s.value === "number" && (
                <p className="text-xs text-slate-500">
                  {s.value}
                  {s.unit ? ` ${s.unit}` : ""}
                </p>
              )}
            </div>
            <StatusBadge tone={tone[s.status]} label={label[s.status]} />
          </li>
        ))}
      </ul>
    </Card>
  );
}
