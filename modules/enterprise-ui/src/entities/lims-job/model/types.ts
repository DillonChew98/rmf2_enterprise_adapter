// One row from the LIMS query (Job6Custom / Entity). These five fields are
// what the LIMS supplies; the operator complements the rest on the Job Input
// tab. `status` is the decoded Job6Custom.Status (A -> Assigned, P -> In Progress).
export interface LimsJob {
  jobNumber: string; // Job6Custom.JobNumber
  analysisType: string; // Job6Custom.Type, e.g. "SEM"
  submissionTime: string; // Job6Custom.XTime (ISO)
  status: "Assigned" | "In Progress";
  stain: string | null; // Entity.DisplayName where EntityTypeID = 48
}
