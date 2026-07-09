import { Card } from "@/shared/ui/Card";

// Which chemical each beaker (1-8) is currently loaded with, reported by the
// device. Separate from Chemical Storage (the cylinder fill levels).
export function BeakerChemicalPanel({ chemicals }: { chemicals: string[] }) {
  const beakers = Array.from({ length: 8 }, (_, i) => chemicals[i] ?? "");
  return (
    <Card title="Beaker Chemical">
      <div className="overflow-hidden rounded-md border border-slate-300">
        <table className="w-full border-collapse text-sm">
          <tbody>
            {beakers.map((chem, i) => (
              <tr key={i} className="border-b border-slate-300 last:border-b-0">
                <td className="w-12 border-r border-slate-300 px-3 py-2 text-center font-medium text-slate-700">
                  {i + 1}
                </td>
                <td className="px-3 py-2 text-slate-800">
                  {chem || <span className="text-slate-300">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
