// Render a chemical mix by percentage, e.g. [{HCl,50},{HNO3,50}] -> "50% HCl + 50% HNO3".
// Kept generic (no entity import) to respect the shared-layer boundary.
export function formatMix(
  components: ReadonlyArray<{ chemical: string; parts: number }>
): string {
  return components
    .filter((c) => c.chemical.trim() !== "")
    .map((c) => `${c.parts}% ${c.chemical}`)
    .join(" + ");
}
