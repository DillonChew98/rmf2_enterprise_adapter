import { api, USE_MOCK } from "@/shared/api/axios";
import type { DelayeringJobRequest } from "../model/types";
import { localNextJobOrder } from "../lib/localJobStore";

// Reserve the next unique work-order id (e.g. "LIMS-JO-0007"). The backend owns
// the counter; in standalone mock mode we fall back to a local counter.
export async function newJobOrder(): Promise<string> {
  if (USE_MOCK) return localNextJobOrder();
  const res = await api.post<{ jobOrder: string }>("/api/machine/job-order/next");
  return res.data.jobOrder;
}

// Push a saved order to the machine so it actually runs it (the device then
// reports the order as completed by its jobOrder). No-op in standalone mock
// mode, where there's no device to talk to.
export async function submitJob(job: DelayeringJobRequest): Promise<void> {
  if (USE_MOCK) return;
  await api.post("/api/machine/request", job);
}
