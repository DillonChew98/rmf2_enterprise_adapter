import { api, USE_MOCK } from "@/shared/api/axios";
import type { MixPreset } from "../model/types";

// Standalone (VITE_USE_MOCK=true) fallback uses localStorage; otherwise the
// device owns the recipes via the adapter.
const KEY = "enterprise-ui:recipes";
const SEED: MixPreset[] = [
  {
    name: "HNO3 · 5m30s · Ultrasonic",
    mode: "single",
    chemical: "HNO3",
    components: [],
    method: "ULTRASONIC",
    durationMin: "5",
    durationSec: "30",
  },
  {
    name: "50% HCl + 50% HNO3 · 1m · NIL",
    mode: "mix",
    chemical: "",
    components: [
      { chemical: "HCl", parts: 50 },
      { chemical: "HNO3", parts: 50 },
    ],
    method: "NIL",
    durationMin: "1",
    durationSec: "",
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
