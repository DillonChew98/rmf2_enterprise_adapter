import { formatMix } from "@/shared/lib/formatMix";

export interface MixComponent {
  chemical: string;
  parts: number;
}

// A reusable process recipe owned by the device. `name` is the auto-generated
// label used as the key (e.g. "HNO3 (50%) · 5m30s · Ultrasonic").
export interface MixPreset {
  name: string;
  mode: "single" | "mix";
  chemical: string; // when mode === "single"
  components: MixComponent[]; // when mode === "mix" (parts = % summing to 100)
  method: string; // "ULTRASONIC" | "HEATED_PLATE" | "ETCHING"
  durationMin: string;
  durationSec: string;
}

const METHOD_LABEL: Record<string, string> = {
  ULTRASONIC: "Ultrasonic",
  HEATED_PLATE: "Heated plate",
  NIL: "NIL",
};

function durationLabel(min: string, sec: string): string {
  const parts: string[] = [];
  if (min.trim()) parts.push(`${min.trim()}m`);
  if (sec.trim()) parts.push(`${sec.trim()}s`);
  return parts.join("");
}

// Build the display label, e.g. "HNO3 · 5m30s · Ultrasonic" or
// "50% HCl + 50% HNO3 · 1m · Etching".
export function recipeLabel(r: MixPreset): string {
  const chem = r.mode === "mix" ? formatMix(r.components) : r.chemical;
  const parts = [chem];
  const d = durationLabel(r.durationMin, r.durationSec);
  if (d) parts.push(d);
  if (r.method) parts.push(METHOD_LABEL[r.method] ?? r.method);
  return parts.filter(Boolean).join(" · ");
}
