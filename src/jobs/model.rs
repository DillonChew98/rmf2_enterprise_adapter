use serde::{Deserialize, Serialize};

/// A submitted delayering job. Common LIMS-derived + operator fields, plus a
/// `jobType`-discriminated body. Mirrors the UI's `DelayeringJobRequest`.

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MixComponent {
    pub chemical: String,
    pub parts: i64,
}

/// One chemical process step — a snapshot of the recipe the operator picked.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChemicalStep {
    #[serde(default)]
    pub recipe_name: String,
    #[serde(default)]
    pub mode: String, // "single" | "mix"
    #[serde(default)]
    pub chemical: String,
    #[serde(default)]
    pub components: Vec<MixComponent>,
    #[serde(default)]
    pub method: String, // "ULTRASONIC" | "HEATED_PLATE" | "ETCHING"
    #[serde(default)]
    pub duration_min: String,
    #[serde(default)]
    pub duration_sec: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Cleaning {
    pub mode: String, // "ALL" | "SELECTED"
    #[serde(default)]
    pub beakers: Vec<String>, // selected beakers e.g. ["1","3"] (when mode = SELECTED)
}

/// The mutually-exclusive job types, discriminated by `jobType`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "jobType", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum JobKind {
    ChemicalProcess { steps: Vec<ChemicalStep> },
    BeakerCleaning { cleaning: Cleaning },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DelayeringJobRequest {
    // LIMS-derived
    pub job_number: String,
    #[serde(default)]
    pub analysis_type: String,
    #[serde(default)]
    pub submission_time: Option<String>,
    #[serde(default)]
    pub lims_status: String,
    #[serde(default)]
    pub stain: Option<String>,
    // operator-supplemented
    pub operator_name: String,
    #[serde(default)]
    pub loadports: Vec<String>, // selected loadports, e.g. ["1","3"]
    #[serde(flatten)]
    pub job: JobKind,
    // server-stamped at submit time
    #[serde(default)]
    pub submitted_at: Option<String>,
}
