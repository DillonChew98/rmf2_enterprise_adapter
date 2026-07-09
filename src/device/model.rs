// Some enum variants exist to mirror the UI's full status unions even though
// the deterministic mock never constructs them (e.g. ERROR).
#![allow(dead_code)]

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::jobs::model::MixComponent;

/// A reusable process recipe owned by the device: a single chemical OR a mix,
/// plus concentration, method, and duration. `name` is the auto-generated label
/// used as the key. Published by the device, read by the UI.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MixPreset {
    pub name: String, // auto-label, e.g. "HNO3 (50%) · 5m30s · Ultrasonic"
    #[serde(default)]
    pub mode: String, // "single" | "mix"
    #[serde(default)]
    pub chemical: String,
    #[serde(default)]
    pub components: Vec<MixComponent>,
    #[serde(default)]
    pub method: String,
    #[serde(default)]
    pub duration_min: String,
    #[serde(default)]
    pub duration_sec: String,
}

// Mirrors the UI's machine types (entities/machine/model/types.ts). Serialized
// camelCase; enum variants serialize as the UI's string unions. Deserialize is
// derived too so the controller can parse the device's MQTT `state` payload.

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SystemStatus {
    Idle,
    Running,
    Error,
    Offline,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum LevelStatus {
    Ok,
    Low,
    Critical,
    Empty,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ProcessStatus {
    NotStarted,
    InProgress,
    Complete,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum CleaningStatus {
    Idle,
    Cleaning,
    Complete,
    Fault,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SensorStatus {
    Ok,
    Triggered,
    Fault,
    Offline,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum StepStatus {
    Pending,
    Active,
    Done,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ConnectionStatus {
    Online,
    Offline,
    ConnectionBroken,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Sensor {
    pub id: String,
    pub name: String,
    pub status: SensorStatus,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub value: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub unit: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobProcessStep {
    pub chemical: String, // "BOE" or a mix like "1:1 HCl+HNO3"
    pub method: String, // "Ultrasonic" | "Heated plate" | "Etching" | "Dispense …"
    pub duration: String, // formatted, e.g. "4 min", "5 sec"
    pub status: StepStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MachineState {
    pub system_status: SystemStatus,
    pub current_job: Option<String>,
    pub current_job_steps: Vec<JobProcessStep>,
    pub last_completed_job: Option<String>,
    pub last_completed_steps: Vec<JobProcessStep>,
    pub last_completed_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub completed_jobs: Vec<String>, // every job number the machine has finished
    pub cycle_time_sec: u32,
    pub error_code: Option<String>,
    pub chemical_level_status: LevelStatus,
    pub process_complete: ProcessStatus,
    pub beaker_cleaning_status: CleaningStatus,
    pub alarm_triggered: bool,
    pub alarm_message: Option<String>,
    pub sensors: Vec<Sensor>,
    pub chemical_storage: Vec<f64>, // 8 cylinders, fill level 0-100%
    #[serde(default)]
    pub beaker_chemicals: Vec<String>, // chemical loaded in each beaker 1-8 ("" = empty)
    pub job_date_time: Option<DateTime<Utc>>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MachineConnection {
    pub status: ConnectionStatus,
    pub received_at: Option<DateTime<Utc>>,
}

/// VDA5050-aligned device `connection` payload published by the device over MQTT.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionPayload {
    pub timestamp: DateTime<Utc>,
    pub device_id: String,
    pub connection_state: String, // "ONLINE" | "OFFLINE"
}

fn sensor(id: &str, name: &str, value: Option<f64>, unit: Option<&str>) -> Sensor {
    Sensor {
        id: id.to_string(),
        name: name.to_string(),
        status: SensorStatus::Ok,
        value,
        unit: unit.map(|u| u.to_string()),
    }
}

pub fn base_sensors() -> Vec<Sensor> {
    vec![
        sensor("ultrasonic_unit", "Ultrasonic Overflow Sensor", None, None),
        sensor("leak_detector", "Leak Detection Sensor", None, None),
    ]
}

impl MachineState {
    /// The device's own starting state (idle, ready to accept a job).
    pub fn idle() -> Self {
        Self {
            system_status: SystemStatus::Idle,
            current_job: None,
            current_job_steps: Vec::new(),
            last_completed_job: None,
            last_completed_steps: Vec::new(),
            last_completed_at: None,
            completed_jobs: Vec::new(),
            cycle_time_sec: 0,
            error_code: None,
            chemical_level_status: LevelStatus::Ok,
            process_complete: ProcessStatus::NotStarted,
            beaker_cleaning_status: CleaningStatus::Idle,
            alarm_triggered: false,
            alarm_message: None,
            sensors: base_sensors(),
            // Spread across the colour ranges so the dashboard is illustrative.
            chemical_storage: vec![85.0, 62.0, 48.0, 33.0, 18.0, 8.0, 0.0, 55.0],
            // Which chemical each beaker (1-8) is loaded with ("" = empty).
            beaker_chemicals: vec![
                "BOE".to_string(),
                "50%HCL; 50%HNO3".to_string(),
                "MAE".to_string(),
                "HF".to_string(),
                String::new(),
                String::new(),
                "HF".to_string(),
                "Choline hydroxide".to_string(),
            ],
            job_date_time: None,
            updated_at: Utc::now(),
        }
    }

    /// What the controller reports to the UI when it has no live state from the
    /// device (broker/device down).
    pub fn offline() -> Self {
        Self {
            system_status: SystemStatus::Offline,
            sensors: Vec::new(),
            ..Self::idle()
        }
    }
}
