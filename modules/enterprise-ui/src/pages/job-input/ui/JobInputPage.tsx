import { useFetch } from "@/shared/lib/hooks/useFetch";
import { listLimsJobs, type LimsJob } from "@/entities/lims-job";
import { JobForm } from "@/entities/job-request";

export function JobInputPage() {
  // Poll the LIMS for available job numbers.
  const { state, refetch } = useFetch<LimsJob[]>(listLimsJobs, {
    intervalMs: 5000,
  });

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-slate-900">Job Input</h2>
        <p className="text-sm text-slate-500">
          Pick a LIMS job, complete the operator inputs, and submit it to the
          delayering machine.
        </p>
      </div>

      {state.status === "loading" && (
        <div className="h-64 animate-pulse rounded-lg border border-slate-200 bg-white" />
      )}

      {state.status === "error" && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Failed to load LIMS jobs: {state.error}
          <button
            type="button"
            onClick={refetch}
            className="ml-2 underline underline-offset-2 hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {state.status === "ok" && <JobForm limsJobs={state.data} />}
    </div>
  );
}
