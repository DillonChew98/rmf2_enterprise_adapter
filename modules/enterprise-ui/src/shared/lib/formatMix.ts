import { chemicalSymbol } from "./chemicals";

// Render a chemical mix by percentage, e.g. [{3,50},{1,50}] -> "50% HCl + 50% HNO3".
// `chemical` is a numeric code (0 = none); the symbol is resolved for display.
export function formatMix(
  components: ReadonlyArray<{ chemical: number; percent?: number }>
): string {
  return components
    .filter((c) => c.chemical > 0)
    .map((c) => `${c.percent ?? 0}% ${chemicalSymbol(c.chemical)}`)
    .join(" + ");
}
