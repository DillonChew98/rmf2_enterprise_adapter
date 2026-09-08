// The FIXED chemical catalog. `chemical` travels on the wire as a numeric code
// (0 = none); this table resolves a code to its display name/symbol.
//
// IMPORTANT: this MUST stay in sync with the backend `chemicals.txt` / catalog.
// Codes are stable (1..8); do not renumber.
export interface ChemicalDef {
  code: number;
  name: string;
  symbol: string;
}

export const CHEMICALS: ChemicalDef[] = [
  { code: 1, name: "Nitric Acid 70% (HNO3)", symbol: "HNO3" },
  { code: 2, name: "Hydrofluoric Acid 49% (HF)", symbol: "HF" },
  { code: 3, name: "Hydrochloric Acid 37% (HCl)", symbol: "HCl" },
  { code: 4, name: "95% Poly Etch MAE (MAE)", symbol: "MAE" },
  { code: 5, name: "BOE 7:1 (BOE)", symbol: "BOE" },
  { code: 6, name: "Choline Hydroxide", symbol: "Choline" },
  { code: 7, name: "Spare 1", symbol: "Spare 1" },
  { code: 8, name: "Spare 2", symbol: "Spare 2" },
];

const BY_CODE = new Map<number, ChemicalDef>(CHEMICALS.map((c) => [c.code, c]));

// Full name for a code, "" for 0 / unknown.
export function chemicalName(code: number): string {
  return BY_CODE.get(code)?.name ?? "";
}

// Short symbol for a code, "" for 0 / unknown.
export function chemicalSymbol(code: number): string {
  return BY_CODE.get(code)?.symbol ?? "";
}

// Dropdown options; value is the stringified code, label is the full name.
export function chemicalOptions(): { value: string; label: string }[] {
  return CHEMICALS.map((c) => ({ value: String(c.code), label: c.name }));
}
