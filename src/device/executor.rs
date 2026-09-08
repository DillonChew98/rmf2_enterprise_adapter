use chrono::Utc;

use crate::device::model::{
    CompletedJob, CurrentJob, JobProcessStep, MachineState, StepStatus, SystemStatus,
};
use crate::jobs::model::{ChemicalStep, RunJob};

/// Deterministic, job-driven execution of the delayering machine. Lives inside
/// the mock device (`bin/mock_device`): the device owns this and advances it on
/// a 1 Hz tick, publishing the resulting `MachineState` over MQTT. No random
/// status changes — everything is driven by the submitted job.
pub struct Executor {
    state: MachineState,
    durations: Vec<u32>, // seconds per display step, parallel to the running job's steps
    seg_idx: usize,
    seg_remaining: u32,
}

impl Executor {
    pub fn new() -> Self {
        Self {
            state: MachineState::idle(),
            durations: Vec::new(),
            seg_idx: 0,
            seg_remaining: 0,
        }
    }

    pub fn snapshot(&self) -> MachineState {
        self.state.clone()
    }

    pub fn running(&self) -> bool {
        matches!(self.state.system_status, SystemStatus::Running)
    }

    /// Try to start one port's job. Returns false if busy (the mock runs one at
    /// a time — the device queues the rest).
    pub fn try_submit(&mut self, job: &RunJob) -> bool {
        if self.running() {
            return false;
        }

        let (mut steps, durations) = build_execution(&job.steps);
        if let Some(first) = steps.first_mut() {
            first.status = StepStatus::Active;
        }

        self.state.system_status = SystemStatus::Running;
        self.state.error_code = None;
        // The mock runs one job at a time, but the field is a list so the real
        // machine can report several concurrent jobs (one per port).
        self.state.current_jobs = vec![CurrentJob {
            job_order: job.job_order.clone(),
            port: job.port.clone(),
            job_number: job.job_number.clone(),
            steps,
        }];

        self.seg_remaining = durations.first().copied().unwrap_or(0);
        self.durations = durations;
        self.seg_idx = 0;
        true
    }

    pub fn tick(&mut self) {
        if !self.running() {
            return;
        }

        // Chemical storage drains only while a job is running.
        for level in self.state.chemical_storage.iter_mut() {
            if *level > 0.0 {
                *level = (*level - 0.8).max(0.0);
            }
        }

        self.seg_remaining = self.seg_remaining.saturating_sub(1);
        if self.seg_remaining == 0 {
            if let Some(s) = self.job_step_mut(self.seg_idx) {
                s.status = StepStatus::Done;
            }
            self.seg_idx += 1;
            if self.seg_idx < self.durations.len() {
                self.seg_remaining = self.durations[self.seg_idx];
                if let Some(s) = self.job_step_mut(self.seg_idx) {
                    s.status = StepStatus::Active;
                }
            } else {
                self.finish();
            }
        }
    }

    // Steps of the (single) job the mock is currently running.
    fn job_step_mut(&mut self, idx: usize) -> Option<&mut JobProcessStep> {
        self.state.current_jobs.first_mut()?.steps.get_mut(idx)
    }

    fn finish(&mut self) {
        // Move the finished job into last_completed (newest first, capped) so the
        // UI can show it and mark the job/order COMPLETED.
        if let Some(job) = self.state.current_jobs.first().cloned() {
            self.state.last_completed.insert(
                0,
                CompletedJob {
                    job_order: job.job_order,
                    port: job.port,
                    job_number: job.job_number,
                    steps: job.steps,
                    at: Utc::now(),
                },
            );
            self.state.last_completed.truncate(200);
        }
        self.state.system_status = SystemStatus::Idle;
        self.state.current_jobs.clear();
        self.durations.clear();
        self.seg_idx = 0;
        self.seg_remaining = 0;
    }
}

impl Default for Executor {
    fn default() -> Self {
        Self::new()
    }
}

/// Build display steps + per-step durations (seconds) for a job's recipe steps.
fn build_execution(steps: &[ChemicalStep]) -> (Vec<JobProcessStep>, Vec<u32>) {
    let display = steps.iter().map(chem_step_display).collect();
    let durations = steps.iter().map(|s| run_secs(s.duration_sec)).collect();
    (display, durations)
}

fn chem_step_display(s: &ChemicalStep) -> JobProcessStep {
    // The state step mirrors the recipe step (mode + chemical/components), plus a
    // live status. mode 2 = mix (components carry the chemistry).
    JobProcessStep {
        mode: s.mode,
        chemical: s.chemical,
        components: s.components.clone(),
        method: s.method,
        duration_sec: s.duration_sec,
        status: StepStatus::Pending,
    }
}

/// Run time the mock actually simulates — clamped to a watchable range so the
/// demo cycles quickly regardless of the real (minutes-long) duration.
fn run_secs(duration_sec: i64) -> u32 {
    (duration_sec.max(0) as u32).clamp(3, 30)
}
