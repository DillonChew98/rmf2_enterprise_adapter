import { api, USE_MOCK } from "@/shared/api/axios";
import type { SelectOption } from "@/shared/ui/Select";
import type { Chemical } from "../model/types";
import { DEFAULT_CHEMICALS } from "../mock/chemicals";

export async function listChemicals(): Promise<Chemical[]> {
  if (USE_MOCK) return DEFAULT_CHEMICALS;
  const res = await api.get<Chemical[]>("/api/chemicals");
  return res.data;
}

export function toChemicalOptions(chemicals: Chemical[]): SelectOption[] {
  // value is the stringified numeric code so the dropdown stores the code.
  return chemicals.map((c) => ({ value: String(c.code), label: c.name }));
}
