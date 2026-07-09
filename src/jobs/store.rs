use async_trait::async_trait;

use crate::jobs::model::DelayeringJobRequest;

/// Persistence seam for submitted jobs. The in-memory impl is used now; a future
/// AMQP sink (publishing `device.v1.*.request`) implements the same trait.
#[async_trait]
pub trait JobStore: Send + Sync {
    async fn submit(&self, job: DelayeringJobRequest) -> anyhow::Result<DelayeringJobRequest>;
    async fn previous(&self) -> anyhow::Result<Option<DelayeringJobRequest>>;
    async fn list(&self) -> anyhow::Result<Vec<DelayeringJobRequest>>;
}
