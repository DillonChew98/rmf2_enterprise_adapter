use async_trait::async_trait;

use crate::jobs::model::DelayeringJobRequest;

/// Persistence seam for submitted jobs. The in-memory impl is used now; a future
/// AMQP sink (publishing `device.v1.*.request`) implements the same trait.
#[async_trait]
pub trait JobStore: Send + Sync {
    /// Generate the next unique work-order id (e.g. "LIMS-JO-0007"). The backend
    /// owns this counter so a job number can be reused across distinct orders.
    async fn next_job_order(&self) -> anyhow::Result<String>;
    async fn submit(&self, job: DelayeringJobRequest) -> anyhow::Result<DelayeringJobRequest>;
    async fn previous(&self) -> anyhow::Result<Option<DelayeringJobRequest>>;
    async fn list(&self) -> anyhow::Result<Vec<DelayeringJobRequest>>;
}
