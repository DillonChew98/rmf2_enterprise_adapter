import { Card } from "@/shared/ui/Card";
import { StatusBadge, type StatusTone } from "@/shared/ui/StatusBadge";
import type { Sensor } from "../model/types";

// Sensors are shown as a simple On/Off indicator.
// sensor status: 1=OK, 2=FAULT, 3=OFFLINE
const tone: Record<number, StatusTone> = {
  1: "ok",
  2: "danger",
  3: "neutral",
};

const label: Record<number, string> = {
  1: "On",
  2: "Off",
  3: "Off",
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
            <StatusBadge
              tone={tone[s.status] ?? "neutral"}
              label={label[s.status] ?? "Off"}
            />
          </li>
        ))}
      </ul>
    </Card>
  );
}
