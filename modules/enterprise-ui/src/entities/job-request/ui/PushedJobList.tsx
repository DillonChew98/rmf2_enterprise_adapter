import { useFetch } from "@/shared/lib/hooks/useFetch";
import { Card } from "@/shared/ui/Card";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { formatTimestamp } from "@/shared/lib/formatTimestamp";
import type { CompletedJob } from "@/entities/machine";
import { listLocalJobs } from "../lib/localJobStore";
import type { DelayeringJobRequest, PortJob } from "../model/types";

// One display row per port of a saved order.
interface OrderRow {
  jobOrder: string;
  port: string;
  job: PortJob;
  operatorName: string;
  submittedAt: string;
}

function toRows(orders: DelayeringJobRequest[]): OrderRow[] {
  return orders.flatMap((o) =>
    Object.entries(o.jobs ?? {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([port, job]) => ({
        jobOrder: o.jobOrder,
        port,
        job,
        operatorName: o.operatorName,
        submittedAt: o.submittedAt,
      }))
  );
}

function summary(job: PortJob): string {
  const names = (job.steps ?? []).map((s) => s.recipeName).filter(Boolean);
  return names.length ? names.join(", ") : `${job.steps?.length ?? 0} step(s)`;
}

interface PushedJobListProps {
  // The machine's finished jobs (state.lastCompleted).
  completed?: CompletedJob[];
}

export function PushedJobList({ completed = [] }: PushedJobListProps) {
  // Poll localStorage so newly saved orders appear without a refresh.
  const { state } = useFetch<DelayeringJobRequest[]>(
    () => Promise.resolve(listLocalJobs()),
    { intervalMs: 2000 }
  );
  const rows = toRows(state.status === "ok" ? state.data : []);

  // A port-job is done when the machine has reported that order id (and, if it
  // reports per-port, that port too). Fall back to job-number match.
  const doneOrders = new Set(completed.map((c) => `${c.jobOrder}/${c.port}`));
  const doneOrderIds = new Set(completed.map((c) => c.jobOrder).filter(Boolean));
  const doneJobNumbers = new Set(completed.map((c) => c.jobNumber));
  const isDone = (r: OrderRow) =>
    r.jobOrder
      ? doneOrders.has(`${r.jobOrder}/${r.port}`) || doneOrderIds.has(r.jobOrder)
      : doneJobNumbers.has(r.job.jobNumber);

  return (
    <Card title={`Pushed Job List (${rows.length})`}>
      {rows.length === 0 ? (
        <p className="py-2 text-sm text-slate-400">No orders saved yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="px-3 py-2 font-medium">Job Order</th>
                <th className="px-3 py-2 font-medium">Port</th>
                <th className="px-3 py-2 font-medium">Job Number</th>
                <th className="px-3 py-2 font-medium">Operator</th>
                <th className="px-3 py-2 font-medium">Recipe</th>
                <th className="px-3 py-2 font-medium">Saved</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={`${r.jobOrder}-${r.port}-${i}`}>
                  <td className="px-3 py-2 font-mono font-medium text-slate-900">
                    {r.jobOrder || "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{r.port}</td>
                  <td className="px-3 py-2 text-slate-700">{r.job.jobNumber}</td>
                  <td className="px-3 py-2 text-slate-600">{r.operatorName}</td>
                  <td className="px-3 py-2 text-slate-600">{summary(r.job)}</td>
                  <td className="px-3 py-2 text-slate-500">
                    {formatTimestamp(r.submittedAt) ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    {isDone(r) ? (
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
