use std::collections::HashMap;

use serde::{Deserialize, Serialize};

/// A submitted delayering work order. One order (jobOrder) loads several ports,
/// each with its own LIMS job + recipe. Mirrors the UI's `DelayeringJobRequest`.

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MixComponent {
    pub chemical: i64, // chemical code (see catalog / ICD chemical code table)
    #[serde(default)]
    pub percent: i64, // share of this chemical in the mix (0–100); components sum to 100
}

/// One chemical process step — a snapshot of the recipe the operator picked.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChemicalStep {
    #[serde(default)]
    pub recipe_name: String,
    #[serde(default)]
    pub mode: i64, // 1=single, 2=mix (see ICD code tables)
    #[serde(default)]
    pub chemical: i64, // single: chemical code (0 when mix)
    #[serde(default)]
    pub components: Vec<MixComponent>,
    #[serde(default)]
    pub method: i64, // method code: 1=NIL, 2=ULTRASONIC, 3=HEATED_PLATE
    #[serde(default)]
    pub duration_sec: i64, // total duration in seconds
}

/// The job loaded on one port: a LIMS reference + the recipe steps to run.
/// LIMS-derived context (analysis type, status, submission time) is deliberately
/// omitted — the machine only needs the job reference, stain, and the recipe.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PortJob {
    pub job_number: String, // LIMS reference (may repeat across ports/orders)
    #[serde(default)]
    pub stain: Option<String>,
    #[serde(default)]
    pub steps: Vec<ChemicalStep>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DelayeringJobRequest {
    /// Unique work-order id (primary key).
    #[serde(default)]
    pub job_order: String,
    pub operator_name: String,
    /// Per-port jobs, keyed by port number (e.g. "1", "2"). Each port can be a
    /// different job number with its own recipe.
    #[serde(default)]
    pub jobs: HashMap<String, PortJob>,
    /// Server-stamped at submit time.
    #[serde(default)]
    pub submitted_at: Option<String>,
}

/// A single runnable unit the machine executes: one port's job. An order expands
/// into one of these per port.
#[derive(Debug, Clone)]
pub struct RunJob {
    pub job_order: String,
    pub port: String,
    pub job_number: String,
    pub steps: Vec<ChemicalStep>,
}

impl DelayeringJobRequest {
    /// Split the order into its per-port runnable jobs.
    pub fn into_run_jobs(self) -> Vec<RunJob> {
        let order = self.job_order;
        self.jobs
            .into_iter()
            .map(|(port, pj)| RunJob {
                job_order: order.clone(),
                port,
                job_number: pj.job_number,
                steps: pj.steps,
            })
            .collect()
    }
}
