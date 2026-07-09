import { useEffect, useState, type ReactNode } from "react";
import { FormProvider, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { LimsJob } from "@/entities/lims-job";
import { listMixPresets, type MixPreset } from "@/entities/mix-preset";
import { useFetch } from "@/shared/lib/hooks/useFetch";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Card } from "@/shared/ui/Card";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { cn } from "@/shared/lib/cn";
import { apiErrorMessage } from "@/shared/api/axios";
import { formatTimestamp } from "@/shared/lib/formatTimestamp";
import { MAX_STEPS } from "../model/types";
import {
  applyLimsJob,
  applyPreviousJob,
  emptyJobForm,
  emptyStep,
  jobFormSchema,
  toJobRequest,
  type JobFormValues,
} from "../model/schema";
import { getPreviousLocalJob, saveLocalJob } from "../lib/localJobStore";
import { ChemicalStepFields } from "./ChemicalStepFields";

function arrayMessage(err: unknown): string | undefined {
  if (err && typeof err === "object") {
    const e = err as { message?: unknown; root?: { message?: unknown } };
    if (typeof e.message === "string") return e.message;
    if (e.root && typeof e.root.message === "string") return e.root.message;
  }
  return undefined;
}

// Persist the in-progress job draft so a page refresh keeps the operator on the
// same view (with their selected job + inputs) instead of resetting.
const STORAGE_KEY = "enterprise-ui:job-input-draft";

function loadDraft(): JobFormValues {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyJobForm();
    // Merge over defaults so a model change can't leave required keys missing.
    return { ...emptyJobForm(), ...JSON.parse(raw) };
  } catch {
    return emptyJobForm();
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

// A right-aligned label + control row, matching the HMI "Input Job Order" layout.
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-[150px_minmax(0,1fr)] sm:items-start sm:gap-4">
      <label className="text-sm font-medium text-slate-700 sm:pt-2 sm:text-right">
        {label}
      </label>
      <div>{children}</div>
    </div>
  );
}

interface JobFormProps {
  limsJobs: LimsJob[];
}

export function JobForm({ limsJobs }: JobFormProps) {
  const methods = useForm<JobFormValues>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: loadDraft(),
    mode: "onSubmit",
  });
  const { register, handleSubmit, watch, setValue, getValues, reset, control, formState } =
    methods;
  const { errors, isSubmitting } = formState;

  // Persist the draft on every change so a refresh restores this view.
  useEffect(() => {
    const sub = watch((value) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      } catch {
        /* ignore quota / disabled storage */
      }
    });
    return () => sub.unsubscribe();
  }, [watch]);

  const stepsArray = useFieldArray({ control, name: "steps" });

  // Device-owned recipes (GET /api/mix-presets) for the process-step dropdowns.
  const { state: recipeState } = useFetch<MixPreset[]>(listMixPresets, {
    intervalMs: 5000,
  });
  const recipes = recipeState.status === "ok" ? recipeState.data : [];

  const [lookup, setLookup] = useState("");
  const [sort, setSort] = useState<{
    key: "jobNumber" | "submissionTime" | "status";
    dir: "asc" | "desc";
  } | null>({ key: "submissionTime", dir: "desc" });
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [submittedJob, setSubmittedJob] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [copyNote, setCopyNote] = useState<string | null>(null);

  const jobNumber = watch("jobNumber");
  const loadports = watch("loadports");
  const hasJob = Boolean(jobNumber);

  function toggleLoadport(n: string) {
    const set = new Set(loadports);
    if (set.has(n)) set.delete(n);
    else set.add(n);
    setValue("loadports", Array.from(set).sort(), { shouldValidate: true });
  }

  const filter = lookup.trim().toLowerCase();
  const filtered = limsJobs.filter(
    (j) =>
      j.jobNumber.toLowerCase().includes(filter) ||
      (j.stain ?? "").toLowerCase().includes(filter)
  );

  // ISO submission times sort lexicographically == chronologically.
  const sorted = sort
    ? [...filtered].sort((a, b) => {
        const cmp = String(a[sort.key] ?? "").localeCompare(
          String(b[sort.key] ?? "")
        );
        return sort.dir === "asc" ? cmp : -cmp;
      })
    : filtered;

  function toggleSort(key: "jobNumber" | "submissionTime" | "status") {
    setSort((cur) =>
      cur && cur.key === key
        ? { key, dir: cur.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  }

  function sortIcon(key: "jobNumber" | "submissionTime" | "status") {
    if (!sort || sort.key !== key) return "↕";
    return sort.dir === "asc" ? "▲" : "▼";
  }

  function selectJob(job: LimsJob) {
    setLookupError(null);
    setSubmittedJob(null);
    reset(applyLimsJob(emptyJobForm(), job));
  }

  function changeJob() {
    clearDraft();
    reset(emptyJobForm());
    setLookup("");
    setSubmittedJob(null);
    setFormError(null);
    setCopyNote(null);
  }

  // Clear the operator inputs but keep the selected LIMS job.
  function clearInputs() {
    const v = getValues();
    reset({
      ...emptyJobForm(),
      jobNumber: v.jobNumber,
      analysisType: v.analysisType,
      submissionTime: v.submissionTime,
      limsStatus: v.limsStatus,
      stain: v.stain,
    });
    setFormError(null);
    setSubmittedJob(null);
    setCopyNote(null);
  }

  function copyPreviousJob() {
    setCopyNote(null);
    const prev = getPreviousLocalJob();
    if (!prev) {
      setCopyNote("No previous job to copy yet.");
      return;
    }
    reset(applyPreviousJob(getValues(), prev));
    setCopyNote(`Copied operator inputs from job ${prev.jobNumber}.`);
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setSubmittedJob(null);
    try {
      saveLocalJob(toJobRequest(values));
      setSubmittedJob(values.jobNumber);
      clearDraft();
    } catch (err) {
      setFormError(apiErrorMessage(err));
    }
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={onSubmit} className="space-y-6">
        {/* Step 1 — pick a job from the LIMS */}
        {!hasJob && (
          <Card title="LIMS Job Lookup">
            <div className="space-y-3">
              <Input
                label="Filter"
                placeholder="Filter by job number or stain…"
                value={lookup}
                onChange={(e) => setLookup(e.target.value)}
              />
              {lookupError && (
                <p className="text-xs text-rose-600">{lookupError}</p>
              )}
              <div className="overflow-hidden rounded-md border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th
                        className="cursor-pointer select-none px-3 py-2 font-medium hover:text-slate-700"
                        onClick={() => toggleSort("jobNumber")}
                      >
                        Job Number{" "}
                        <span className="text-slate-400">
                          {sortIcon("jobNumber")}
                        </span>
                      </th>
                      <th className="px-3 py-2 font-medium">Analysis</th>
                      <th
                        className="cursor-pointer select-none px-3 py-2 font-medium hover:text-slate-700"
                        onClick={() => toggleSort("submissionTime")}
                      >
                        Submitted{" "}
                        <span className="text-slate-400">
                          {sortIcon("submissionTime")}
                        </span>
                      </th>
                      <th
                        className="cursor-pointer select-none px-3 py-2 font-medium hover:text-slate-700"
                        onClick={() => toggleSort("status")}
                      >
                        Status{" "}
                        <span className="text-slate-400">
                          {sortIcon("status")}
                        </span>
                      </th>
                      <th className="px-3 py-2 font-medium">Stain</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sorted.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-3 py-6 text-center text-slate-400"
                        >
                          No matching LIMS jobs.
                        </td>
                      </tr>
                    ) : (
                      sorted.map((j) => (
                        <tr key={j.jobNumber} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-medium text-slate-900">
                            {j.jobNumber}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {j.analysisType}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {formatTimestamp(j.submissionTime) ?? "—"}
                          </td>
                          <td className="px-3 py-2">
                            <StatusBadge
                              tone={j.status === "In Progress" ? "active" : "info"}
                              label={j.status}
                            />
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {j.stain ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Button size="sm" onClick={() => selectJob(j)}>
                              Select
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500">
                {limsJobs.length} open job(s) from the LIMS · refreshes
                automatically.
              </p>
            </div>
          </Card>
        )}

        {/* Step 2 — Input Job Order (HMI slide 7) */}
        {hasJob && (
          <section className="rounded-lg border border-slate-300 bg-white shadow-sm">
            <div className="rounded-t-lg border-b border-slate-300 bg-slate-200 px-5 py-3 text-center">
              <h3 className="text-base font-semibold text-slate-900">
                Input Job Order
              </h3>
            </div>

            <div className="space-y-5 px-6 py-6">
              <Row label="Job Number">
                <Input value={jobNumber} readOnly disabled />
                <p className="mt-1 text-xs text-slate-500">
                  {[
                    watch("analysisType"),
                    watch("limsStatus"),
                    watch("stain"),
                    formatTimestamp(watch("submissionTime") || null),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </Row>

              <Row label="Operator name">
                <Input
                  error={errors.operatorName?.message}
                  {...register("operatorName")}
                />
              </Row>

              <Row label="Select Port#">
                <div className="flex gap-2">
                  {["1", "2", "3", "4"].map((n) => {
                    const active = loadports.includes(n);
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => toggleLoadport(n)}
                        aria-pressed={active}
                        className={cn(
                          "h-9 w-9 rounded-full border text-sm font-medium transition",
                          active
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                        )}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
                {arrayMessage(errors.loadports) && (
                  <p className="mt-1 text-xs text-rose-600">
                    {arrayMessage(errors.loadports)}
                  </p>
                )}
              </Row>

              <div className="space-y-3">
                {stepsArray.fields.map((field, i) => (
                  <ChemicalStepFields
                    key={field.id}
                    index={i}
                    removable={stepsArray.fields.length > 1}
                    onRemove={() => stepsArray.remove(i)}
                    recipes={recipes}
                  />
                ))}
                {arrayMessage(errors.steps) && (
                  <p className="text-xs text-rose-600">
                    {arrayMessage(errors.steps)}
                  </p>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => stepsArray.append(emptyStep())}
                  disabled={stepsArray.fields.length >= MAX_STEPS}
                >
                  + Add process step ({stepsArray.fields.length}/{MAX_STEPS})
                </Button>
              </div>

              {copyNote && (
                <p className="rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-600">
                  {copyNote}
                </p>
              )}
              {formError && (
                <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {formError}
                </p>
              )}
              {submittedJob && (
                <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  Job {submittedJob} saved to the pushed job list.
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
                <Button variant="ghost" size="sm" onClick={copyPreviousJob}>
                  Copy previous job
                </Button>
                <div className="flex-1" />
                <Button
                  onClick={clearInputs}
                  className="bg-sky-700 text-white hover:bg-sky-800"
                >
                  Clear ALL
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-amber-400 text-slate-900 hover:bg-amber-500"
                >
                  {isSubmitting ? "Saving…" : "Save"}
                </Button>
                <Button variant="secondary" onClick={changeJob}>
                  Return
                </Button>
              </div>
            </div>
          </section>
        )}
      </form>
    </FormProvider>
  );
}
