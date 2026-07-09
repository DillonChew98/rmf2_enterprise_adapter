import { api, USE_MOCK } from "@/shared/api/axios";
import type { LimsJob } from "../model/types";
import { LIMS_JOBS } from "../mock/limsSeed";

const URL = "/api/lims/jobs";

export async function listLimsJobs(): Promise<LimsJob[]> {
  if (USE_MOCK) return LIMS_JOBS;
  const res = await api.get<LimsJob[]>(URL);
  return res.data;
}
