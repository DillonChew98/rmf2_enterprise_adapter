use std::sync::Mutex;

use async_trait::async_trait;

use crate::jobs::model::DelayeringJobRequest;
use crate::jobs::store::JobStore;

/// In-memory job store (most-recent-first). The LIMS stays read-only; submitted
/// jobs live here until a real sink (AMQP) is wired up.
#[derive(Default)]
pub struct MemoryJobStore {
    jobs: Mutex<Vec<DelayeringJobRequest>>,
}

impl MemoryJobStore {
    pub fn new() -> Self {
        Self::default()
    }
}

#[async_trait]
impl JobStore for MemoryJobStore {
    async fn submit(
        &self,
        job: DelayeringJobRequest,
    ) -> anyhow::Result<DelayeringJobRequest> {
        let mut guard = self.jobs.lock().expect("job store mutex poisoned");
        guard.insert(0, job.clone());
        Ok(job)
    }

    async fn previous(&self) -> anyhow::Result<Option<DelayeringJobRequest>> {
        let guard = self.jobs.lock().expect("job store mutex poisoned");
        Ok(guard.first().cloned())
    }

    async fn list(&self) -> anyhow::Result<Vec<DelayeringJobRequest>> {
        let guard = self.jobs.lock().expect("job store mutex poisoned");
        Ok(guard.clone())
    }
}
