import type { DelayeringJobRequest } from "../model/types";

// Job Input "Save" stores jobs ONLY in this local UI store (localStorage) —
// nothing is pushed to the device. The dashboard's Pushed Job List reads it.
const KEY = "enterprise-ui:pushed-jobs";

export function listLocalJobs(): DelayeringJobRequest[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DelayeringJobRequest[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalJob(job: DelayeringJobRequest): DelayeringJobRequest {
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
