import { useState } from "react";
import { useFetch } from "@/shared/lib/hooks/useFetch";
import { apiErrorMessage } from "@/shared/api/axios";
import { formatMix } from "@/shared/lib/formatMix";
import { cn } from "@/shared/lib/cn";
import { Card } from "@/shared/ui/Card";
import { Input } from "@/shared/ui/Input";
import { Select } from "@/shared/ui/Select";
import { Button } from "@/shared/ui/Button";
import { Field } from "@/shared/ui/Field";
import {
  listChemicals,
  toChemicalOptions,
  type Chemical,
} from "@/entities/chemical";
import {
  listMixPresets,
  saveMixPreset,
  recipeLabel,
  type MixPreset,
} from "@/entities/mix-preset";
import { MAX_MIX_COMPONENTS } from "@/entities/job-request";

// method wire codes: 1=NIL, 2=ULTRASONIC, 3=HEATED_PLATE
const METHOD_OPTIONS = [
  { value: "1", label: "NIL" },
  { value: "2", label: "Ultrasonic" },
  { value: "3", label: "Heated plate" },
];

interface Comp {
  chemical: number; // chemical code; 0 = none
  percent: number;
}

export function RecipePage() {
  const { state: chemState } = useFetch<Chemical[]>(listChemicals);
  const chemicalOptions =
    chemState.status === "ok" ? toChemicalOptions(chemState.data) : [];

  const { state: mixState, refetch } = useFetch<MixPreset[]>(listMixPresets, {
    intervalMs: 5000,
  });
  const recipes = mixState.status === "ok" ? mixState.data : [];

  const [name, setName] = useState("");
  const [nameEdited, setNameEdited] = useState(false);
  const [mode, setMode] = useState<"single" | "mix">("single");
  const [chemical, setChemical] = useState(0); // chemical code; 0 = none
  const [comps, setComps] = useState<Comp[]>([{ chemical: 0, percent: 0 }]);
  const [method, setMethod] = useState(1); // 1=NIL, 2=ULTRASONIC, 3=HEATED_PLATE
  const [durMin, setDurMin] = useState("");
  const [durSec, setDurSec] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // The operator enters minutes + seconds; the recipe stores a single integer
  // of total seconds.
  const durationSec =
    (parseInt(durMin, 10) || 0) * 60 + (parseInt(durSec, 10) || 0);
  const draft: MixPreset = {
    name: "",
    mode: mode === "mix" ? 2 : 1,
    chemical,
    components: comps,
    method,
    durationSec,
  };
  // The name auto-fills from the composition, but the operator can rename it.
  // Clearing the field reverts to the auto name.
  const label = recipeLabel(draft);
  const displayName = nameEdited ? name : label;
  const percentTotal = comps
    .filter((c) => c.chemical > 0)
    .reduce((s, c) => s + (c.percent || 0), 0);

  const optionsFor = (row: number) => {
    // Options carry the chemical code as a stringified value.
    const used = new Set(
      comps
        .filter((_, k) => k !== row)
        .map((c) => c.chemical)
        .filter((code) => code > 0)
        .map(String)
    );
    const current = comps[row] ? String(comps[row].chemical) : "";
    return chemicalOptions.filter(
      (o) => o.value === current || !used.has(o.value)
    );
  };

  const update = (i: number, patch: Partial<Comp>) =>
    setComps((prev) => prev.map((c, k) => (k === i ? { ...c, ...patch } : c)));

  function reset() {
    setName("");
    setNameEdited(false);
    setMode("single");
    setChemical(0);
    setComps([{ chemical: 0, percent: 0 }]);
    setMethod(1);
    setDurMin("");
    setDurSec("");
  }

  async function save() {
    setError(null);
    setSaved(null);
    const recipeName = displayName.trim();
    if (!recipeName) return setError("Enter a recipe name");
    if (mode === "single") {
      if (!chemical) return setError("Select a chemical");
    } else {
      const valid = comps.filter((c) => c.chemical > 0);
      if (valid.length < 1) return setError("Add at least one chemical");
      const codes = valid.map((c) => c.chemical);
      if (new Set(codes).size !== codes.length)
        return setError("Chemicals must be unique");
      if (valid.some((c) => !(c.percent > 0)))
        return setError("Each chemical needs a percentage");
      if (percentTotal !== 100)
        return setError(`Percentages must add up to 100% (currently ${percentTotal}%)`);
    }
    if (durationSec <= 0) return setError("Enter a duration");

    const preset: MixPreset = {
      ...draft,
      chemical: mode === "single" ? chemical : 0,
      components: mode === "mix" ? comps.filter((c) => c.chemical > 0) : [],
      name: recipeName,
    };
    setSaving(true);
    try {
      await saveMixPreset(preset);
      setSaved(recipeName);
      reset();
      refetch();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-slate-900">Recipes</h2>
        <p className="text-sm text-slate-500">
          Build process recipes owned by the machine — pick them per process step
          on the Job Input screen.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="New recipe">
          <div className="space-y-4">
            <Input
              label="Recipe name"
              placeholder="e.g. BOE etch step 1"
              value={displayName}
              onChange={(e) => {
                const v = e.target.value;
                setName(v);
                setNameEdited(v.trim() !== "");
              }}
            />

            {/* single / mix */}
            <div className="inline-flex overflow-hidden rounded-md border border-slate-300">
              {(["single", "mix"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={cn(
                    "px-3 py-1.5 text-sm font-medium transition",
                    mode === m
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-700 hover:bg-slate-50"
                  )}
                >
                  {m === "single" ? "Single chemical" : "Mix"}
                </button>
              ))}
            </div>

            {mode === "single" ? (
              <Select
                label="Chemical"
                placeholder="Select chemical"
                options={chemicalOptions}
                value={chemical ? String(chemical) : ""}
                onChange={(e) => setChemical(Number(e.target.value) || 0)}
              />
            ) : (
              <div className="space-y-2">
                {comps.map((c, i) => (
                  <div key={i} className="flex items-end gap-2">
                    <div className="grid flex-1 grid-cols-[1fr_100px] gap-2">
                      <Select
                        label={`Chemical ${i + 1}`}
                        placeholder="Select"
                        options={optionsFor(i)}
                        value={c.chemical ? String(c.chemical) : ""}
                        onChange={(e) =>
                          update(i, { chemical: Number(e.target.value) || 0 })
                        }
                      />
                      <Input
                        label="Percent (%)"
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={c.percent}
                        onChange={(e) =>
                          update(i, { percent: Number(e.target.value) })
                        }
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setComps(comps.filter((_, k) => k !== i))}
                      disabled={comps.length <= 1}
                      aria-label="Remove chemical"
                    >
                      ✕
                    </Button>
                  </div>
                ))}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setComps([...comps, { chemical: 0, percent: 0 }])}
                  disabled={comps.length >= MAX_MIX_COMPONENTS}
                >
                  + Add chemical
                </Button>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">
                    {formatMix(comps) || "—"}
                  </span>
                  <span
                    className={cn(
                      "font-medium",
                      percentTotal === 100 ? "text-emerald-600" : "text-rose-600"
                    )}
                  >
                    Total: {percentTotal}%
                  </span>
                </div>
              </div>
            )}

            <Select
              label="Option"
              options={METHOD_OPTIONS}
              value={String(method)}
              onChange={(e) => setMethod(Number(e.target.value) || 1)}
            />

            <Field label="Duration">
              <div className="flex items-center gap-2">
                <Input
                  className="w-16"
                  placeholder="0"
                  inputMode="numeric"
                  value={durMin}
                  onChange={(e) => setDurMin(e.target.value)}
                />
                <span className="text-sm text-slate-500">min</span>
                <Input
                  className="w-16"
                  placeholder="0"
                  inputMode="numeric"
                  value={durSec}
                  onChange={(e) => setDurSec(e.target.value)}
                />
                <span className="text-sm text-slate-500">sec</span>
              </div>
            </Field>

            <Field label="Preview">
              <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800">
                {label || <span className="text-slate-400">—</span>}
              </div>
            </Field>

            {error && (
              <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            )}
            {saved && (
              <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                Saved “{saved}” to the machine.
              </p>
            )}

            <div className="flex justify-end">
              <Button onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save recipe"}
              </Button>
            </div>
          </div>
        </Card>

        <Card title={`Saved recipes (${recipes.length})`}>
          {recipes.length === 0 ? (
            <p className="py-2 text-sm text-slate-400">No recipes yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recipes.map((r) => (
                <li key={r.name} className="py-3 text-sm">
                  <p className="font-medium text-slate-900">{r.name}</p>
                  <p className="text-xs text-slate-500">{recipeLabel(r)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
