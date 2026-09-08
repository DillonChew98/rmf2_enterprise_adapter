import { useState } from "react";
import type { LimsJob } from "@/entities/lims-job";
import {
  listMixPresets,
  recipeLabel,
  type MixPreset,
} from "@/entities/mix-preset";
import { useFetch } from "@/shared/lib/hooks/useFetch";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { Select } from "@/shared/ui/Select";
import { Combobox } from "@/shared/ui/Combobox";
import { Toast } from "@/shared/ui/Toast";
import { Card } from "@/shared/ui/Card";
import { cn } from "@/shared/lib/cn";
import { apiErrorMessage } from "@/shared/api/axios";
import { PORTS, MAX_STEPS } from "../model/types";
import {
  emptyPort,
  emptyStep,
  applyLimsToPort,
  buildJobRequest,
  requestToPorts,
  type PortForm,
} from "../model/schema";
import { getPreviousLocalJob, saveLocalJob } from "../lib/localJobStore";
import { newJobOrder, submitJob } from "../api/jobApi";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-[130px_minmax(0,1fr)] sm:items-start sm:gap-4">
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
  const [jobOrder, setJobOrder] = useState<string | null>(null);
  const [operatorName, setOperatorName] = useState("");
  const [ports, setPorts] = useState<PortForm[]>([emptyPort("1")]);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    tone: "success" | "error";
  } | null>(null);
  const [copyNote, setCopyNote] = useState<string | null>(null);
  const [ordering, setOrdering] = useState(false);
  const [saving, setSaving] = useState(false);

  const { state: recipeState } = useFetch<MixPreset[]>(listMixPresets, {
    intervalMs: 5000,
  });
  const recipes = recipeState.status === "ok" ? recipeState.data : [];
  const recipeOptions = recipes.map((r) => ({
    value: r.name,
    label: `${r.name} — ${recipeLabel(r)}`,
  }));
  const limsOptions = limsJobs.map((j) => ({
    value: j.jobNumber,
    label: `${j.jobNumber} · ${j.analysisType} · ${j.status}`,
  }));

  const usedPorts = ports.map((p) => p.port);
  const portOptions = (current: string) =>
    PORTS.filter((p) => p === current || !usedPorts.includes(p)).map((p) => ({
      value: p,
      label: p,
    }));

  function updatePort(i: number, patch: Partial<PortForm>) {
    setPorts((prev) => prev.map((p, k) => (k === i ? { ...p, ...patch } : p)));
  }

  function pickLims(i: number, jobNumber: string) {
    const job = limsJobs.find((j) => j.jobNumber === jobNumber);
    setPorts((prev) =>
      prev.map((p, k) =>
        k === i
          ? job
            ? applyLimsToPort(p, job)
            : { ...p, jobNumber: "" }
          : p
      )
    );
  }

  function pickRecipe(pi: number, si: number, name: string) {
    const r = recipes.find((x) => x.name === name);
    setPorts((prev) =>
      prev.map((p, k) => {
        if (k !== pi) return p;
        const steps = p.steps.map((s, m) =>
          m === si
            ? r
              ? {
                  recipeName: r.name,
                  mode: r.mode,
                  chemical: r.chemical,
                  components: r.components,
                  method: r.method,
                  durationSec: r.durationSec,
                }
              : emptyStep()
            : s
        );
        return { ...p, steps };
      })
    );
  }

  function addStep(pi: number) {
    setPorts((prev) =>
      prev.map((p, k) =>
        k === pi && p.steps.length < MAX_STEPS
          ? { ...p, steps: [...p.steps, emptyStep()] }
          : p
      )
    );
  }
  function removeStep(pi: number, si: number) {
    setPorts((prev) =>
      prev.map((p, k) =>
        k === pi ? { ...p, steps: p.steps.filter((_, m) => m !== si) } : p
      )
    );
  }

  function addPort() {
    const free = PORTS.find((p) => !usedPorts.includes(p));
    if (free) setPorts((prev) => [...prev, emptyPort(free)]);
  }
  function removePort(i: number) {
    setPorts((prev) => prev.filter((_, k) => k !== i));
  }

  // Clears the form back to empty (leaves any active toast to auto-dismiss).
  function reset() {
    setJobOrder(null);
    setOperatorName("");
    setPorts([emptyPort("1")]);
    setError(null);
    setCopyNote(null);
  }

  // Step 1 of the flow: ask the backend for a fresh work-order id, then start a
  // blank order under it.
  async function newOrder() {
    setError(null);
    setToast(null);
    setCopyNote(null);
    setOrdering(true);
    try {
      const jo = await newJobOrder();
      setJobOrder(jo);
      setOperatorName("");
      setPorts([emptyPort("1")]);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setOrdering(false);
    }
  }

  function copyPrevious() {
    setCopyNote(null);
    const prev = getPreviousLocalJob();
    if (!prev) {
      setCopyNote("No previous order to copy yet.");
      return;
    }
    setOperatorName(prev.operatorName);
    setPorts(requestToPorts(prev));
    setCopyNote(`Copied ports from ${prev.jobOrder} into ${jobOrder}.`);
  }

  async function save() {
    setError(null);
    setToast(null);
    if (!jobOrder) return setError("Click 'New order' to generate a job order first");
    if (!operatorName.trim()) return setError("Enter an operator name");
    const withJob = ports.filter((p) => p.jobNumber.trim());
    if (withJob.length === 0)
      return setError("Assign a job number to at least one port");
    for (const p of withJob) {
      if (!p.steps.some((s) => s.recipeName))
        return setError(`Port ${p.port}: pick at least one recipe`);
    }

    const request = buildJobRequest(jobOrder, operatorName.trim(), ports);
    setSaving(true);
    try {
      const saved = saveLocalJob(request);
      let sent = false;
      try {
        await submitJob(saved);
        sent = true;
      } catch {
        /* saved locally regardless; stays PENDING if the machine is unreachable */
      }
      reset();
      setToast(
        sent
          ? {
              message: `Order ${saved.jobOrder} sent to the machine ✓`,
              tone: "success",
            }
          : {
              message: `Order ${saved.jobOrder} saved — machine unreachable`,
              tone: "error",
            }
      );
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-300 bg-white shadow-sm">
      {toast && (
        <Toast
          message={toast.message}
          tone={toast.tone}
          onDismiss={() => setToast(null)}
        />
      )}
      <div className="rounded-t-lg border-b border-slate-300 bg-slate-200 px-5 py-3 text-center">
        <h3 className="text-base font-semibold text-slate-900">Input Job Order</h3>
      </div>

      <div className="space-y-5 px-6 py-6">
        {/* Step 1: the operator gets a backend-assigned work-order id, then
            fills in the ports/jobs/recipes under it. */}
        <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-sm">
            {jobOrder ? (
              <span className="text-slate-700">
                Job order{" "}
                <span className="font-semibold text-slate-900">{jobOrder}</span>
              </span>
            ) : (
              <span className="text-slate-500">
                No active order — generate one to begin.
              </span>
            )}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={newOrder}
            disabled={ordering}
          >
            {ordering ? "Generating…" : "New order"}
          </Button>
        </div>

        {copyNote && (
          <p className="rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-600">
            {copyNote}
          </p>
        )}
        {error && (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}

        {jobOrder && (
          <>
        <Row label="Operator name">
          <Input
            value={operatorName}
            onChange={(e) => setOperatorName(e.target.value)}
          />
        </Row>

        {ports.map((p, i) => (
          <Card key={i} title={`Port ${p.port}`}>
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[120px_minmax(0,1fr)]">
                <Select
                  label="Port #"
                  options={portOptions(p.port)}
                  value={p.port}
                  onChange={(e) => updatePort(i, { port: e.target.value })}
                />
                <Combobox
                  label="Job Number"
                  placeholder="Search LIMS jobs…"
                  options={limsOptions}
                  value={p.jobNumber}
                  onChange={(v) => pickLims(i, v)}
                />
              </div>
              {p.jobNumber && (
                <p className="text-xs text-slate-500">
                  {[p.analysisType, p.limsStatus, p.stain].filter(Boolean).join(" · ")}
                </p>
              )}

              <div className="space-y-2">
                {p.steps.map((s, si) => (
                  <div key={si} className="flex items-end gap-2">
                    <div className="flex-1">
                      <Select
                        label={`Process step #${si + 1}`}
                        placeholder="Select a recipe…"
                        options={recipeOptions}
                        value={s.recipeName}
                        onChange={(e) => pickRecipe(i, si, e.target.value)}
                      />
                    </div>
                    {p.steps.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeStep(i, si)}
                        aria-label="Remove step"
                      >
                        ✕
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => addStep(i)}
                  disabled={p.steps.length >= MAX_STEPS}
                >
                  + Add process step ({p.steps.length}/{MAX_STEPS})
                </Button>
              </div>

              {ports.length > 1 && (
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => removePort(i)}>
                    Remove port
                  </Button>
                </div>
              )}
            </div>
          </Card>
        ))}

        <Button
          variant="secondary"
          size="sm"
          onClick={addPort}
          disabled={usedPorts.length >= PORTS.length}
        >
          + Add port
        </Button>

        <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
          <Button variant="ghost" size="sm" onClick={copyPrevious}>
            Copy previous order
          </Button>
          <div className="flex-1" />
          <Button
            onClick={reset}
            className={cn("bg-sky-700 text-white hover:bg-sky-800")}
          >
            Clear ALL
          </Button>
          <Button
            onClick={save}
            disabled={saving}
            className="bg-amber-400 text-slate-900 hover:bg-amber-500"
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
          </>
        )}
      </div>
    </section>
  );
}
