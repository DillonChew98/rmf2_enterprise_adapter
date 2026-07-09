import type { Chemical } from "../model/types";

// Standalone fallback (VITE_USE_MOCK=true) — mirrors the adapter's built-in
// default catalog.
export const DEFAULT_CHEMICALS: Chemical[] = [
  "BOE",
  "HCl",
  "HNO3",
  "HF",
  "Poly etch (MAE)",
  "Choline hydroxide",
  "H2SO4",
  "H2O2",
  "H2O",
].map((name) => ({ name }));
