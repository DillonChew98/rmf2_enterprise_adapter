use async_trait::async_trait;

use crate::lims::model::LimsJob;

/// The LIMS data source seam. The REST layer depends only on this trait, so the
/// backing driver (tiberius / future sqlx / mock) is swappable without changing
/// any RMF2-facing code.
#[async_trait]
pub trait LimsRepository: Send + Sync {
    async fn list_jobs(&self) -> anyhow::Result<Vec<LimsJob>>;
    async fn get_job(&self, job_number: &str) -> anyhow::Result<Option<LimsJob>>;
}
