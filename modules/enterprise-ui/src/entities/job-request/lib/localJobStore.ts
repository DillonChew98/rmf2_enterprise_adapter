import type { DelayeringJobRequest } from "../model/types";

// Job Input "Save" stores jobs ONLY in this local UI store (localStorage) —
// nothing is pushed to the device. The dashboard's Pushed Job List reads it.
const KEY = "enterprise-ui:pushed-jobs";
const SEQ_KEY = "enterprise-ui:job-order-seq";

// Monotonic, unique work-order ID: "LMS" + 7-hex running number
// (LMS0000000..LMSFFFFFFF, ~268M orders). Normally the backend assigns this;
// this local counter is only the standalone (mock) fallback used by
// `newJobOrder()` when there's no adapter to ask.
export function localNextJobOrder(): string {
  let n = 0;
  try {
    n = Number(localStorage.getItem(SEQ_KEY) ?? "0") + 1;
    localStorage.setItem(SEQ_KEY, String(n));
  } catch {
    n = Date.now(); // fallback if storage is unavailable
  }
  const hex = (n & 0xfffffff).toString(16).toUpperCase().padStart(7, "0");
  return `LMS${hex}`;
}

export function listLocalJobs(): DelayeringJobRequest[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DelayeringJobRequest[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalJob(job: DelayeringJobRequest): DelayeringJobRequest {
  // The jobOrder is already assigned (by the backend via `newJobOrder()`); the
  // store just records the order for the dashboard's Pushed Job List.
  const list = listLocalJobs();
  list.unshift(job); // most recent first
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore quota / disabled storage */
  }
  return job;
}

export function getPreviousLocalJob(): DelayeringJobRequest | null {
  return listLocalJobs()[0] ?? null;
}
