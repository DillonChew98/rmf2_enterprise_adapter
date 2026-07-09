import { useFormContext } from "react-hook-form";
import { Select } from "@/shared/ui/Select";
import { Button } from "@/shared/ui/Button";
import { recipeLabel, type MixPreset } from "@/entities/mix-preset";
import type { ProcessMethod } from "../model/types";
import type { JobFormValues } from "../model/schema";

interface Props {
  index: number;
  onRemove: () => void;
  removable: boolean;
  recipes: MixPreset[];
}

// One process step — pick a recipe from the device's recipe list.
export function ChemicalStepFields({
  index,
  onRemove,
  removable,
  recipes,
}: Props) {
  const {
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<JobFormValues>();

  const recipeName = watch(`steps.${index}.recipeName`);
  const stepErr = errors.steps?.[index];

  const options = recipes.map((r) => ({ value: r.name, label: recipeLabel(r) }));

  // Picking a recipe snapshots its fields into the step.
  function pick(name: string) {
    const r = recipes.find((x) => x.name === name);
    setValue(`steps.${index}.recipeName`, r ? r.name : "", {
      shouldValidate: true,
    });
    if (!r) return;
    setValue(`steps.${index}.mode`, r.mode);
    setValue(`steps.${index}.chemical`, r.chemical);
    setValue(`steps.${index}.components`, r.components);
    setValue(`steps.${index}.method`, r.method as ProcessMethod);
    setValue(`steps.${index}.durationMin`, r.durationMin);
    setValue(`steps.${index}.durationSec`, r.durationSec);
  }

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1">
        <Select
          label={`Process step #${index + 1}`}
          placeholder="Select a recipe…"
          options={options}
          value={recipeName}
          onChange={(e) => pick(e.target.value)}
          error={stepErr?.recipeName?.message}
        />
      </div>
      {removable && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          aria-label="Remove step"
        >
          ✕
        </Button>
      )}
    </div>
  );
}
