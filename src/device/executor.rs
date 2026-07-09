use chrono::Utc;

use crate::device::model::{
    CleaningStatus, JobProcessStep, MachineState, ProcessStatus, StepStatus, SystemStatus,
};
use crate::jobs::model::{ChemicalStep, DelayeringJobRequest, JobKind, MixComponent};

/// Deterministic, job-driven execution of the delayering machine. Lives inside
/// the mock device (`bin/mock_device`): the device owns this and advances it on
/// a 1 Hz tick, publishing the resulting `MachineState` over MQTT. No random
/// status changes — everything is driven by the submitted job.
pub struct Executor {
    state: MachineState,
    durations: Vec<u32>, // seconds per display step, parallel to current_job_steps
    seg_idx: usize,
    seg_remaining: u32,
    is_cleaning_job: bool,
    cleaning_tail: u32,
    in_tail: bool,
}

impl Executor {
    pub fn new() -> Self {
        Self {
            state: MachineState::idle(),
            durations: Vec::new(),
            seg_idx: 0,
            seg_remaining: 0,
            is_cleaning_job: false,
            cleaning_tail: 0,
            in_tail: false,
        }
    }

    pub fn snapshot(&self) -> MachineState {
        self.state.clone()
    }

    pub fn running(&self) -> bool {
        matches!(self.state.system_status, SystemStatus::Running)
    }

    /// Try to start a job. Returns false if busy (the device rejects it).
    pub fn try_submit(&mut self, job: &DelayeringJobRequest) -> bool {
        if self.running() {
            return false;
        }

        let (mut steps, durations, is_cleaning_job) = build_execution(job);
        if let Some(first) = steps.first_mut() {
            first.status = StepStatus::Active;
        }

        let s = &mut self.state;
        s.system_status = SystemStatus::Running;
        s.current_job = Some(job.job_number.clone());
        s.job_date_time = Some(Utc::now());
        s.cycle_time_sec = 0;
        s.process_complete = ProcessStatus::InProgress;
        s.error_code = None;
        s.alarm_triggered = false;
        s.alarm_message = None;
        s.beaker_cleaning_status = if is_cleaning_job {
            CleaningStatus::Cleaning
        } else {
            CleaningStatus::Idle
        };
        s.current_job_steps = steps;
        s.updated_at = Utc::now();

        self.seg_remaining = durations.first().copied().unwrap_or(0);
        self.durations = durations;
        self.seg_idx = 0;
        self.is_cleaning_job = is_cleaning_job;
        // Beaker cleaning only runs as its own job — never automatically after
        // a chemical process.
        self.cleaning_tail = 0;
        self.in_tail = false;
        true
    }

    pub fn tick(&mut self) {
        if !self.running() {
            return;
        }
        self.state.cycle_time_sec += 1;

        // Chemical storage drains only while a job is running.
        for level in self.state.chemical_storage.iter_mut() {
            if *level > 0.0 {
                *level = (*level - 0.8).max(0.0);
            }
        }

        if self.in_tail {
            self.seg_remaining = self.seg_remaining.saturating_sub(1);
            if self.seg_remaining == 0 {
                self.state.beaker_cleaning_status = CleaningStatus::Complete;
                self.finish();
            }
        } else {
            self.seg_remaining = self.seg_remaining.saturating_sub(1);
            if self.seg_remaining == 0 {
                if let Some(s) = self.state.current_job_steps.get_mut(self.seg_idx) {
                    s.status = StepStatus::Done;
                }
                self.seg_idx += 1;
                if self.seg_idx < self.durations.len() {
                    self.seg_remaining = self.durations[self.seg_idx];
                    if let Some(s) = self.state.current_job_steps.get_mut(self.seg_idx) {
                        s.status = StepStatus::Active;
                    }
                } else {
                    self.state.process_complete = ProcessStatus::Complete;
                    if self.is_cleaning_job {
                        self.state.beaker_cleaning_status = CleaningStatus::Complete;
                    }
                    if self.cleaning_tail > 0 {
                        self.in_tail = true;
                        self.seg_remaining = self.cleaning_tail;
                        self.state.beaker_cleaning_status = CleaningStatus::Cleaning;
                    } else {
                        self.finish();
                    }
                }
            }
        }

        self.state.updated_at = Utc::now();
    }

    fn finish(&mut self) {
        // Remember the job that just finished so the dashboard can show it.
        if let Some(job) = self.state.current_job.clone() {
            self.state.last_completed_job = Some(job.clone());
            self.state.last_completed_steps = self.state.current_job_steps.clone();
            self.state.last_completed_at = Some(Utc::now());
            // Track the completed job number so the UI's Pushed Job List can mark
            // it COMPLETED. Newest first, de-duplicated, capped.
            self.state.completed_jobs.retain(|n| n != &job);
            self.state.completed_jobs.insert(0, job);
            self.state.completed_jobs.truncate(100);
        }
        self.state.system_status = SystemStatus::Idle;
        self.state.current_job = None;
        self.state.current_job_steps.clear();
        self.state.job_date_time = None;
        self.durations.clear();
        self.seg_idx = 0;
        self.seg_remaining = 0;
        self.in_tail = false;
        self.is_cleaning_job = false;
        self.cleaning_tail = 0;
    }
}

impl Default for Executor {
    fn default() -> Self {
        Self::new()
    }
}

/// Build display steps + per-step durations (seconds). Returns (steps, durations, is_cleaning_job).
fn build_execution(job: &DelayeringJobRequest) -> (Vec<JobProcessStep>, Vec<u32>, bool) {
    match &job.job {
        JobKind::ChemicalProcess { steps } => {
            let display = steps.iter().map(chem_step_display).collect();
            let durations = steps
                .iter()
                .map(|s| total_secs(&s.duration_min, &s.duration_sec))
                .collect();
            (display, durations, false)
        }
        JobKind::BeakerCleaning { cleaning } => {
            let selected = cleaning.mode.eq_ignore_ascii_case("SELECTED");
            let target = if selected {
                if cleaning.beakers.is_empty() {
                    "Selected beakers".to_string()
                } else {
                    format!("Beakers {}", cleaning.beakers.join(", "))
                }
            } else {
                "All beakers".to_string()
            };
            let count = if selected {
                cleaning.beakers.len().max(1) as u32
            } else {
                9
            };
            let secs = (count * 3).clamp(6, 30);
            let step = JobProcessStep {
                chemical: target,
                method: "Beaker cleaning".to_string(),
                duration: String::new(),
                status: StepStatus::Pending,
            };
            (vec![step], vec![secs], true)
        }
    }
}

fn chem_step_display(s: &ChemicalStep) -> JobProcessStep {
    let chemical = if s.mode == "mix" {
        format_mix(&s.components)
    } else {
        s.chemical.clone()
    };
    JobProcessStep {
        chemical,
        method: method_label(&s.method),
        duration: format_duration(&s.duration_min, &s.duration_sec),
        status: StepStatus::Pending,
    }
}

/// Combine minutes + seconds into a display string, e.g. "2 min 30 sec".
fn format_duration(min: &str, sec: &str) -> String {
    let mut parts = Vec::new();
    if !min.trim().is_empty() {
        parts.push(format!("{} min", min.trim()));
    }
    if !sec.trim().is_empty() {
        parts.push(format!("{} sec", sec.trim()));
    }
    parts.join(" ")
}

fn method_label(m: &str) -> String {
    match m {
        "ULTRASONIC" => "Ultrasonic",
        "HEATED_PLATE" => "Heated plate",
        "NIL" => "NIL",
        other => other,
    }
    .to_string()
}

fn format_mix(components: &[MixComponent]) -> String {
    components
        .iter()
        .filter(|c| !c.chemical.trim().is_empty())
        .map(|c| format!("{}% {}", c.parts, c.chemical))
        .collect::<Vec<_>>()
        .join(" + ")
}

/// Leading number from a free-form value ("4", "20-40", "2/1.5/1") -> 4, 20, 2.
fn parse_leading(s: &str) -> u32 {
    let mut num = String::new();
    for c in s.chars() {
        if c.is_ascii_digit() {
            num.push(c);
        } else if !num.is_empty() {
            break;
        }
    }
    num.parse::<u32>().unwrap_or(0)
}

/// Total run time in seconds from minutes + seconds, clamped to a watchable range.
fn total_secs(min: &str, sec: &str) -> u32 {
    (parse_leading(min) * 60 + parse_leading(sec)).clamp(3, 30)
}
