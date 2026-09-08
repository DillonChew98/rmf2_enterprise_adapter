import { formatMix } from "@/shared/lib/formatMix";
import { chemicalSymbol } from "@/shared/lib/chemicals";

export interface MixComponent {
  chemical: number; // chemical code (1..8); 0 = none
  percent: number; // share of this chemical in the mix (0–100); components sum to 100
}

// A reusable process recipe owned by the device. `name` is an operator-defined
// label used as the key (e.g. "BOE etch step 1"). Fully numeric on the wire to
// match the backend `MixPreset`.
export interface MixPreset {
  name: string;
  mode: number; // 1=single, 2=mix
  chemical: number; // chemical code when mode === 1 (single); 0 for a mix
  components: MixComponent[]; // when mode === 2 (mix) (each with a % share; sum 100)
  method: number; // 1=NIL, 2=ULTRASONIC, 3=HEATED_PLATE
  durationSec: number; // total duration in seconds
}

const METHOD_LABEL: Record<number, string> = {
  1: "NIL",
  2: "Ultrasonic",
  3: "Heated plate",
};

// Human-readable duration from total seconds, e.g. 330 -> "5m30s", 60 -> "1m".
export function durationLabel(totalSec: number): string {
  const total = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  const parts: string[] = [];
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 || m === 0) parts.push(`${s}s`);
  return parts.join("");
}

// Build the display label, e.g. "HNO3 · 5m30s · Ultrasonic" or
// "50% HCl + 50% HNO3 · 1m · NIL".
export function recipeLabel(r: MixPreset): string {
  const chem = r.mode === 2 ? formatMix(r.components) : chemicalSymbol(r.chemical);
  const parts = [chem];
  const d = durationLabel(r.durationSec);
  if (d) parts.push(d);
  if (r.method) parts.push(METHOD_LABEL[r.method] ?? String(r.method));
  return parts.filter(Boolean).join(" · ");
}
