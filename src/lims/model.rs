use chrono::{DateTime, Utc};
use serde::Serialize;

/// One row of the LIMS query result. Serialized as camelCase to match the UI's
/// `LimsJob` type (jobNumber, analysisType, submissionTime, status, stain).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LimsJob {
    pub job_number: String,
    pub analysis_type: String,
    pub submission_time: Option<DateTime<Utc>>,
    pub status: String,
    pub stain: Option<String>,
}
