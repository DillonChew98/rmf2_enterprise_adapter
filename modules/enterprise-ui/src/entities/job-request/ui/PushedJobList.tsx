import { useFetch } from "@/shared/lib/hooks/useFetch";
import { Card } from "@/shared/ui/Card";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { formatTimestamp } from "@/shared/lib/formatTimestamp";
import { listLocalJobs } from "../lib/localJobStore";
import { JOB_TYPE_LABELS, type DelayeringJobRequest } from "../model/types";

function summary(j: DelayeringJobRequest): string {
  const names = (j.steps ?? []).map((s) => s.recipeName).filter(Boolean);
  return names.length ? names.join(", ") : `${j.steps?.length ?? 0} step(s)`;
}

interface PushedJobListProps {
  // Job numbers the machine has reported as finished (from its state).
  completedJobs?: string[];
}

export function PushedJobList({ completedJobs = [] }: PushedJobListProps) {
  // Poll localStorage so newly saved jobs appear without a refresh.
  const { state } = useFetch<DelayeringJobRequest[]>(
    () => Promise.resolve(listLocalJobs()),
    { intervalMs: 2000 }
  );
  const jobs = state.status === "ok" ? state.data : [];
  const completed = new Set(completedJobs);

  return (
    <Card title={`Pushed Job List (${jobs.length})`}>
      {jobs.length === 0 ? (
        <p className="py-2 text-sm text-slate-400">No jobs saved yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="px-3 py-2 font-medium">Job Number</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Operator</th>
                <th className="px-3 py-2 font-medium">Ports</th>
                <th className="px-3 py-2 font-medium">Details</th>
                <th className="px-3 py-2 font-medium">Saved</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobs.map((j, i) => (
                <tr key={`${j.jobNumber}-${i}`}>
                  <td className="px-3 py-2 font-medium text-slate-900">
                    {j.jobNumber}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge tone="active" label={JOB_TYPE_LABELS[j.jobType]} />
                  </td>
                  <td className="px-3 py-2 text-slate-600">{j.operatorName}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {j.loadports.join(", ") || "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{summary(j)}</td>
                  <td className="px-3 py-2 text-slate-500">
                    {formatTimestamp(j.submittedAt) ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    {completed.has(j.jobNumber) ? (
                      <StatusBadge tone="ok" label="COMPLETED" />
                    ) : (
                      <StatusBadge tone="neutral" label="PENDING" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
