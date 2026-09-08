// Some enum variants exist to mirror the UI's full status unions even though
// the deterministic mock never constructs them (e.g. ERROR).
#![allow(dead_code)]

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_repr::{Deserialize_repr, Serialize_repr};

use crate::jobs::model::MixComponent;

/// A reusable process recipe owned by the device: a single chemical OR a mix,
/// plus concentration, method, and duration. `name` is the auto-generated label
/// used as the key. Published by the device, read by the UI.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MixPreset {
    pub name: String, // operator-defined recipe name, e.g. "HNO3 etch"
    #[serde(default)]
    pub mode: i64, // 1=single, 2=mix
    #[serde(default)]
    pub chemical: i64, // single: chemical code (0 when mix)
    #[serde(default)]
    pub components: Vec<MixComponent>,
    #[serde(default)]
    pub method: i64, // 1=NIL, 2=ULTRASONIC, 3=HEATED_PLATE
    #[serde(default)]
    pub duration_sec: i64, // total duration in seconds
}

// Mirrors the UI's machine types (entities/machine/model/types.ts). Serialized
// camelCase; enum variants serialize as integer codes (see the ICD code tables).
// Deserialize is derived too so the controller can parse the device's MQTT
// `state` payload.

#[derive(Debug, Clone, Copy, Serialize_repr, Deserialize_repr, PartialEq, Eq)]
#[repr(u8)]
pub enum SystemStatus {
    Idle = 1,
    Running = 2,
    Error = 3,
    Offline = 4,
}

#[derive(Debug, Clone, Copy, Serialize_repr, Deserialize_repr)]
#[repr(u8)]
pub enum SensorStatus {
    Ok = 1,
    Fault = 2,
    Offline = 3,
}

#[derive(Debug, Clone, Copy, Serialize_repr, Deserialize_repr)]
#[repr(u8)]
pub enum StepStatus {
    Pending = 1,
    Active = 2,
    Done = 3,
}

#[derive(Debug, Clone, Copy, Serialize_repr, Deserialize_repr, PartialEq, Eq)]
#[repr(u8)]
pub enum ConnectionStatus {
    Online = 1,
    Offline = 2,
    ConnectionBroken = 3,
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
    pub mode: i64,                    // 1=single, 2=mix
    pub chemical: i64,                // single: chemical code (0 when mix)
    pub components: Vec<MixComponent>, // mix: [{chemical, percent}]
    pub method: i64,                  // method code (see ICD code tables)
    pub duration_sec: i64,            // total duration in seconds
    pub status: StepStatus,
}

/// A job the machine is running now (it can run several at once, one per port).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CurrentJob {
    pub job_order: String, // "" for ambient (non-operator) jobs
    pub port: String,
    pub job_number: String,
    pub steps: Vec<JobProcessStep>,
}

/// A job the machine has finished (newest first).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompletedJob {
    pub job_order: String,
    pub port: String,
    pub job_number: String,
    pub steps: Vec<JobProcessStep>,
    pub at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MachineState {
    pub system_status: SystemStatus,
    #[serde(default)]
    pub current_jobs: Vec<CurrentJob>, // jobs running now (0..N)
    #[serde(default)]
    pub last_completed: Vec<CompletedJob>, // finished jobs, newest first (capped)
    pub error_code: Option<String>,
    pub sensors: Vec<Sensor>,
    pub chemical_storage: Vec<f64>, // 8 cylinders, fill level 0-100%
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
    pub connection_state: i64, // 1=ONLINE, 2=OFFLINE (see ICD code tables)
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
            current_jobs: Vec::new(),
            last_completed: Vec::new(),
            error_code: None,
            sensors: base_sensors(),
            // Spread across the colour ranges so the dashboard is illustrative.
            chemical_storage: vec![85.0, 62.0, 48.0, 33.0, 18.0, 8.0, 0.0, 55.0],
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
