use std::sync::Mutex;
use std::sync::atomic::{AtomicU64, Ordering};

use async_trait::async_trait;

use crate::jobs::model::DelayeringJobRequest;
use crate::jobs::store::JobStore;

/// In-memory job store (most-recent-first). The LIMS stays read-only; submitted
/// jobs live here until a real sink (AMQP) is wired up.
#[derive(Default)]
pub struct MemoryJobStore {
    jobs: Mutex<Vec<DelayeringJobRequest>>,
    order_seq: AtomicU64,
}

impl MemoryJobStore {
    pub fn new() -> Self {
        Self::default()
    }
}

#[async_trait]
impl JobStore for MemoryJobStore {
    async fn next_job_order(&self) -> anyhow::Result<String> {
        let n = self.order_seq.fetch_add(1, Ordering::Relaxed) + 1;
        // LMS + 7-hex running number (0000000..FFFFFFF, ~268M orders). "LMS" = LIMS.
        // e.g. LMS0000001. Masked to 7 hex digits (wraps at FFFFFFF).
        Ok(format!("LMS{:07X}", n & 0xFFF_FFFF))
    }

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
