import { api, USE_MOCK } from "@/shared/api/axios";
import type { MixPreset } from "../model/types";

// Standalone (VITE_USE_MOCK=true) fallback uses localStorage; otherwise the
// device owns the recipes via the adapter.
const KEY = "enterprise-ui:recipes";
// Numeric wire codes (mode 1=single/2=mix; method 1=NIL/2=ULTRASONIC/
// 3=HEATED_PLATE; chemical = catalog code). Mirrors the backend seeds.
const SEED: MixPreset[] = [
  {
    name: "HNO3 etch",
    mode: 1,
    chemical: 1, // HNO3
    components: [],
    method: 2, // ULTRASONIC
    durationSec: 330,
  },
  {
    name: "HCl + HNO3 mix",
    mode: 2,
    chemical: 0,
    components: [
      { chemical: 3, percent: 50 }, // HCl
      { chemical: 1, percent: 50 }, // HNO3
    ],
    method: 1, // NIL
    durationSec: 60,
  },
];

function localList(): MixPreset[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as MixPreset[]) : SEED;
  } catch {
    return SEED;
  }
}

function localSave(preset: MixPreset) {
  const list = localList().filter((m) => m.name !== preset.name);
  list.push(preset);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export async function listMixPresets(): Promise<MixPreset[]> {
  if (USE_MOCK) return localList();
  const res = await api.get<MixPreset[]>("/api/mix-presets");
  return res.data;
}

export async function saveMixPreset(preset: MixPreset): Promise<void> {
  if (USE_MOCK) {
    localSave(preset);
    return;
  }
  await api.post("/api/mix-presets", preset);
}
