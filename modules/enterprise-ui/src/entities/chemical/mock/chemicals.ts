import type { Chemical } from "../model/types";
import { CHEMICALS } from "@/shared/lib/chemicals";

// Standalone fallback (VITE_USE_MOCK=true) — the FIXED catalog (codes 1..8),
// mirroring the adapter's built-in default catalog.
export const DEFAULT_CHEMICALS: Chemical[] = CHEMICALS.map((c) => ({
  code: c.code,
  name: c.name,
}));
