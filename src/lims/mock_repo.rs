use async_trait::async_trait;
use chrono::{DateTime, TimeZone, Utc};

use crate::lims::model::LimsJob;
use crate::lims::repository::LimsRepository;

/// In-memory LIMS source so the adapter runs with no database
/// (`LIMS_BACKEND=mock`). Same shape as the SQL Server query result.
pub struct MockLimsRepository {
    jobs: Vec<LimsJob>,
}

impl MockLimsRepository {
    pub fn new() -> Self {
        Self { jobs: seed() }
    }
}

impl Default for MockLimsRepository {
    fn default() -> Self {
        Self::new()
    }
}

fn ymd(y: i32, m: u32, d: u32) -> Option<DateTime<Utc>> {
    Utc.with_ymd_and_hms(y, m, d, 0, 0, 0).single()
}

fn seed() -> Vec<LimsJob> {
    vec![
        LimsJob { job_number: "F1026-07747".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 4, 9), status: "In Progress".into(), stain: Some("NA".into()) },
        LimsJob { job_number: "F1026-07748".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 4, 9), status: "In Progress".into(), stain: Some("NA".into()) },
        LimsJob { job_number: "F1026-07940".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 4, 20), status: "In Progress".into(), stain: Some("NA".into()) },
        LimsJob { job_number: "F1026-08519".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 4, 19), status: "Assigned".into(), stain: Some("Dry Stain".into()) },
        LimsJob { job_number: "F1026-08532".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 4, 20), status: "In Progress".into(), stain: Some("NA".into()) },
        LimsJob { job_number: "F1026-09183".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 5, 4), status: "Assigned".into(), stain: Some("Dry Stain".into()) },
        LimsJob { job_number: "F1026-09260".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 4, 29), status: "In Progress".into(), stain: Some("Dry Stain".into()) },
        LimsJob { job_number: "F1026-09265".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 4, 29), status: "In Progress".into(), stain: Some("Dry Stain".into()) },
        LimsJob { job_number: "F1026-09269".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 4, 29), status: "In Progress".into(), stain: Some("NA".into()) },
        LimsJob { job_number: "F1026-09270".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 4, 29), status: "In Progress".into(), stain: Some("NA".into()) },
        LimsJob { job_number: "F1026-09304".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 4, 30), status: "In Progress".into(), stain: Some("NA".into()) },
        LimsJob { job_number: "F1026-09308".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 4, 30), status: "In Progress".into(), stain: Some("NA".into()) },
        LimsJob { job_number: "F1026-09314".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 4, 30), status: "In Progress".into(), stain: Some("NA".into()) },
        LimsJob { job_number: "F1026-09345".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 4, 30), status: "In Progress".into(), stain: Some("Dry Stain".into()) },
        LimsJob { job_number: "F1026-09347".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 4, 30), status: "In Progress".into(), stain: Some("Dry Stain".into()) },
        LimsJob { job_number: "F1026-09348".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 4, 30), status: "In Progress".into(), stain: Some("Dry Stain".into()) },
        LimsJob { job_number: "F1026-09349".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 4, 30), status: "In Progress".into(), stain: Some("Dry Stain".into()) },
        LimsJob { job_number: "F1026-09350".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 4, 30), status: "In Progress".into(), stain: Some("Dry Stain".into()) },
        LimsJob { job_number: "F1026-09352".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 4, 30), status: "In Progress".into(), stain: Some("Dry Stain".into()) },
        LimsJob { job_number: "F1026-09384".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 4, 30), status: "In Progress".into(), stain: Some("Dry Stain".into()) },
        LimsJob { job_number: "F1026-09400".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 5, 1), status: "In Progress".into(), stain: Some("NA".into()) },
        LimsJob { job_number: "F1026-09468".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 5, 1), status: "In Progress".into(), stain: Some("Dry Stain".into()) },
        LimsJob { job_number: "F1026-09500".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 5, 2), status: "In Progress".into(), stain: Some("Dry Stain".into()) },
        LimsJob { job_number: "F1026-09501".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 5, 2), status: "Assigned".into(), stain: Some("Dry Stain".into()) },
        LimsJob { job_number: "F1026-09502".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 5, 2), status: "In Progress".into(), stain: Some("Dry Stain".into()) },
        LimsJob { job_number: "F1026-09503".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 5, 2), status: "Assigned".into(), stain: Some("Dry Stain".into()) },
        LimsJob { job_number: "F1026-09504".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 5, 2), status: "In Progress".into(), stain: Some("NA".into()) },
        LimsJob { job_number: "F1026-09505".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 5, 2), status: "In Progress".into(), stain: Some("NA".into()) },
        LimsJob { job_number: "F1026-09506".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 5, 2), status: "In Progress".into(), stain: Some("NA".into()) },
        LimsJob { job_number: "F1026-09512".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 5, 2), status: "In Progress".into(), stain: Some("Dry Stain".into()) },
        LimsJob { job_number: "F1026-09513".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 5, 2), status: "In Progress".into(), stain: Some("BOE stain".into()) },
        LimsJob { job_number: "F1026-09514".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 5, 2), status: "In Progress".into(), stain: Some("BOE stain".into()) },
        LimsJob { job_number: "F1026-09515".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 5, 2), status: "In Progress".into(), stain: Some("BOE stain".into()) },
        LimsJob { job_number: "F1026-09519".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 5, 3), status: "In Progress".into(), stain: Some("NA".into()) },
        LimsJob { job_number: "F1026-09520".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 5, 3), status: "In Progress".into(), stain: Some("NA".into()) },
        LimsJob { job_number: "F1026-09521".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 5, 3), status: "In Progress".into(), stain: Some("NA".into()) },
        LimsJob { job_number: "F1026-09522".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 5, 3), status: "In Progress".into(), stain: Some("NA".into()) },
        LimsJob { job_number: "F1026-09531".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 5, 3), status: "In Progress".into(), stain: Some("Fischione+Dry Stain".into()) },
        LimsJob { job_number: "F1026-09532".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 5, 3), status: "In Progress".into(), stain: Some("Fischione+Dry Stain".into()) },
        LimsJob { job_number: "F1026-09540".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 5, 3), status: "In Progress".into(), stain: Some("Dry Stain".into()) },
        LimsJob { job_number: "F1026-09541".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 5, 3), status: "In Progress".into(), stain: Some("Dry Stain".into()) },
        LimsJob { job_number: "F1026-09545".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 5, 3), status: "In Progress".into(), stain: Some("Dry Stain".into()) },
        LimsJob { job_number: "F1026-09566".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 5, 4), status: "Assigned".into(), stain: Some("NA".into()) },
        LimsJob { job_number: "F1026-09570".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 5, 4), status: "In Progress".into(), stain: Some("Dry Stain".into()) },
        LimsJob { job_number: "F1026-09573".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 5, 4), status: "In Progress".into(), stain: Some("BOE stain".into()) },
        LimsJob { job_number: "F1026-09578".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 5, 4), status: "In Progress".into(), stain: Some("Dry Stain".into()) },
        LimsJob { job_number: "F1026-09583".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 5, 4), status: "In Progress".into(), stain: Some("Dry Stain".into()) },
        LimsJob { job_number: "F1026-09585".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 5, 4), status: "In Progress".into(), stain: Some("Dry Stain".into()) },
        LimsJob { job_number: "F1026-09586".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 5, 4), status: "In Progress".into(), stain: Some("Dry Stain".into()) },
        LimsJob { job_number: "F1026-09589".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 5, 4), status: "In Progress".into(), stain: Some("Dry Stain".into()) },
        LimsJob { job_number: "F1026-09591".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 5, 4), status: "In Progress".into(), stain: Some("Dry Stain".into()) },
        LimsJob { job_number: "F1026-09593".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 5, 4), status: "In Progress".into(), stain: Some("Dry Stain".into()) },
        LimsJob { job_number: "F1026-09595".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 5, 4), status: "In Progress".into(), stain: Some("Dry Stain".into()) },
        LimsJob { job_number: "F1026-09596".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 5, 4), status: "In Progress".into(), stain: Some("Dry Stain".into()) },
        LimsJob { job_number: "F1026-09600".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 5, 4), status: "In Progress".into(), stain: Some("BOE stain".into()) },
        LimsJob { job_number: "F1026-09602".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 5, 4), status: "In Progress".into(), stain: Some("BOE stain".into()) },
        LimsJob { job_number: "F1026-09603".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 5, 4), status: "In Progress".into(), stain: Some("NA".into()) },
        LimsJob { job_number: "F1026-09669".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 5, 5), status: "In Progress".into(), stain: Some("HF 5sec".into()) },
        LimsJob { job_number: "F1026-09670".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 5, 5), status: "In Progress".into(), stain: Some("HF 5sec".into()) },
        LimsJob { job_number: "F1026-09671".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 5, 5), status: "In Progress".into(), stain: Some("HF 5sec".into()) },
        LimsJob { job_number: "F1026-09675".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 5, 5), status: "In Progress".into(), stain: Some("NA".into()) },
        LimsJob { job_number: "F1026-09691".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 5, 5), status: "In Progress".into(), stain: Some("NA".into()) },
        LimsJob { job_number: "F1026-09701".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 5, 5), status: "In Progress".into(), stain: Some("BOE stain".into()) },
        LimsJob { job_number: "F1026-09703".into(), analysis_type: "SEM".into(), submission_time: ymd(2026, 5, 5), status: "In Progress".into(), stain: Some("BOE stain".into()) },
    ]
}

#[async_trait]
impl LimsRepository for MockLimsRepository {
    async fn list_jobs(&self) -> anyhow::Result<Vec<LimsJob>> {
        Ok(self.jobs.clone())
    }

    async fn get_job(&self, job_number: &str) -> anyhow::Result<Option<LimsJob>> {
        Ok(self.jobs.iter().find(|j| j.job_number == job_number).cloned())
    }
}
