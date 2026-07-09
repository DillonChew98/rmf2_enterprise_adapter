// Mock delayering machine. Speaks the RMF2 device contract over MQTT:
//   publishes `connection` (heartbeat) and `state` (1 Hz),
//   consumes `request` (a job) and executes it deterministically.
// While running a job it ignores new requests — the authoritative busy guard.

use std::sync::{Arc, Mutex};
use std::time::Duration;

use chrono::Utc;
use rumqttc::{AsyncClient, Event, MqttOptions, Packet, QoS};
use tracing::{info, warn};

use rmf2_enterprise_adapter::config::Config;
use rmf2_enterprise_adapter::device::executor::Executor;
use rmf2_enterprise_adapter::device::model::{ConnectionPayload, MixPreset};
use rmf2_enterprise_adapter::device::topics::MachineTopics;
use rmf2_enterprise_adapter::jobs::model::{
    ChemicalStep, DelayeringJobRequest, JobKind, MixComponent,
};

const MIX_PRESETS_FILE: &str = "mix_presets.json";

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();
    dotenvy::dotenv().ok();

    let cfg = Config::from_env();
    let topics = MachineTopics::new(&cfg.mqtt.manufacturer, &cfg.mqtt.device_id);
    let device_id = cfg.mqtt.device_id.clone();

    let mut opts = MqttOptions::new("delayer-mock", &cfg.mqtt.host, cfg.mqtt.port);
    opts.set_keep_alive(Duration::from_secs(5));
    let (client, mut eventloop) = AsyncClient::new(opts, 16);

    let exec = Arc::new(Mutex::new(Executor::new()));
    let presets = Arc::new(Mutex::new(load_presets()));

    {
        let exec = exec.clone();
        let client = client.clone();
        let topics = topics.clone();
        tokio::spawn(async move {
            let mut tick = tokio::time::interval(Duration::from_secs(1));
            loop {
                tick.tick().await;
                let snapshot = {
                    let mut g = exec.lock().expect("executor mutex poisoned");
                    g.tick();
                    g.snapshot()
                };
                if let Ok(payload) = serde_json::to_vec(&snapshot) {
                    let _ = client
                        .publish(topics.state.clone(), QoS::AtMostOnce, true, payload)
                        .await;
                }
            }
        });
    }

    // Connection heartbeat.
    {
        let client = client.clone();
        let topics = topics.clone();
        let device_id = device_id.clone();
        tokio::spawn(async move {
            let mut tick = tokio::time::interval(Duration::from_secs(5));
            loop {
                tick.tick().await;
                publish_connection(&client, &topics, &device_id).await;
            }
        });
    }

    // Demo job runner: keeps the machine working through a small queue so the
    // dashboard always shows a live Current Job and a Last Completed. Submits the
    // next demo job a few seconds after the previous one finishes (the idle gap
    // lets the "Last Completed" tab be visible). Real submitted jobs still take
    // priority via the executor's busy guard.
    {
        let exec = exec.clone();
        tokio::spawn(async move {
            let jobs = demo_jobs();
            let mut idx = 0usize;
            let mut idle_secs = 0u32;
            let mut tick = tokio::time::interval(Duration::from_secs(1));
            loop {
                tick.tick().await;
                let running = exec.lock().expect("executor mutex poisoned").running();
                if running {
                    idle_secs = 0;
                    continue;
                }
                idle_secs += 1;
                if idle_secs >= 4 {
                    idle_secs = 0;
                    let job = jobs[idx % jobs.len()].clone();
                    idx += 1;
                    exec.lock()
                        .expect("executor mutex poisoned")
                        .try_submit(&job);
                }
            }
        });
    }

    info!(
        device = %device_id,
        host = %cfg.mqtt.host,
        port = cfg.mqtt.port,
        "mock delayering device starting"
    );

    loop {
        match eventloop.poll().await {
            Ok(Event::Incoming(Packet::ConnAck(_))) => {
                let _ = client
                    .subscribe(topics.request.clone(), QoS::AtMostOnce)
                    .await;
                let _ = client
                    .subscribe(topics.mixes_save.clone(), QoS::AtMostOnce)
                    .await;
                publish_connection(&client, &topics, &device_id).await;
                let snapshot = presets.lock().expect("presets mutex poisoned").clone();
                publish_mixes(&client, &topics, &snapshot).await;
                info!("device online; subscribed to request + mixes_save");
            }
            Ok(Event::Incoming(Packet::Publish(p))) if p.topic == topics.mixes_save => {
                match serde_json::from_slice::<MixPreset>(&p.payload) {
                    Ok(preset) => {
                        {
                            let mut g = presets.lock().expect("presets mutex poisoned");
                            g.retain(|m| m.name != preset.name);
                            g.push(preset.clone());
                        }
                        let snapshot =
                            presets.lock().expect("presets mutex poisoned").clone();
                        save_presets(&snapshot);
                        publish_mixes(&client, &topics, &snapshot).await;
                        info!(mix = %preset.name, "mix preset saved");
                    }
                    Err(e) => warn!(error = %e, "bad mix-save payload"),
                }
            }
            Ok(Event::Incoming(Packet::Publish(p))) if p.topic == topics.request => {
                match serde_json::from_slice::<DelayeringJobRequest>(&p.payload) {
                    Ok(job) => {
                        let accepted = {
                            exec.lock().expect("executor mutex poisoned").try_submit(&job)
                        };
                        info!(job = %job.job_number, accepted, "request received");
                        // Reflect acceptance immediately.
                        let snapshot =
                            { exec.lock().expect("executor mutex poisoned").snapshot() };
                        if let Ok(payload) = serde_json::to_vec(&snapshot) {
                            let _ = client
                                .publish(topics.state.clone(), QoS::AtMostOnce, true, payload)
                                .await;
                        }
                    }
                    Err(e) => warn!(error = %e, "bad request payload"),
                }
            }
            Ok(_) => {}
            Err(e) => {
                warn!(error = %e, "mqtt error; retrying");
                tokio::time::sleep(Duration::from_secs(1)).await;
            }
        }
    }
}

async fn publish_connection(client: &AsyncClient, topics: &MachineTopics, device_id: &str) {
    let payload = ConnectionPayload {
        timestamp: Utc::now(),
        device_id: device_id.to_string(),
        connection_state: "ONLINE".to_string(),
    };
    if let Ok(bytes) = serde_json::to_vec(&payload) {
        let _ = client
            .publish(topics.connection.clone(), QoS::AtLeastOnce, true, bytes)
            .await;
    }
}

// The device's mix presets are published retained so the controller gets the
// current list as soon as it subscribes.
async fn publish_mixes(client: &AsyncClient, topics: &MachineTopics, presets: &[MixPreset]) {
    if let Ok(bytes) = serde_json::to_vec(presets) {
        let _ = client
            .publish(topics.mixes.clone(), QoS::AtLeastOnce, true, bytes)
            .await;
    }
}

// A small demo queue so the dashboard always has something to show. Step
// durations are clamped to a few seconds by the executor, so jobs cycle quickly.
fn demo_jobs() -> Vec<DelayeringJobRequest> {
    let single = |chemical: &str, method: &str, m: &str, s: &str| ChemicalStep {
        recipe_name: String::new(),
        mode: "single".to_string(),
        chemical: chemical.to_string(),
        components: vec![],
        method: method.to_string(),
        duration_min: m.to_string(),
        duration_sec: s.to_string(),
    };
    let mix = |a: &str, b: &str, method: &str, m: &str, s: &str| ChemicalStep {
        recipe_name: String::new(),
        mode: "mix".to_string(),
        chemical: String::new(),
        components: vec![
            MixComponent { chemical: a.to_string(), parts: 50 },
            MixComponent { chemical: b.to_string(), parts: 50 },
        ],
        method: method.to_string(),
        duration_min: m.to_string(),
        duration_sec: s.to_string(),
    };
    let job = |number: &str, operator: &str, ports: &[&str], steps: Vec<ChemicalStep>| {
        DelayeringJobRequest {
            job_number: number.to_string(),
            analysis_type: "SEM".to_string(),
            submission_time: None,
            lims_status: "P".to_string(),
            stain: None,
            operator_name: operator.to_string(),
            loadports: ports.iter().map(|p| p.to_string()).collect(),
            job: JobKind::ChemicalProcess { steps },
            submitted_at: None,
        }
    };
    vec![
        job(
            "J-100482",
            "A. Tan",
            &["1", "2"],
            vec![
                single("HNO3", "ULTRASONIC", "5", "30"),
                mix("HCl", "HNO3", "NIL", "1", ""),
            ],
        ),
        job(
            "J-100483",
            "M. Lee",
            &["3"],
            vec![
                single("BOE", "NIL", "2", ""),
                single("HF", "ULTRASONIC", "", "5"),
            ],
        ),
        job(
            "J-100484",
            "R. Goh",
            &["4"],
            vec![single("Choline hydroxide", "HEATED_PLATE", "3", "")],
        ),
    ]
}

fn default_presets() -> Vec<MixPreset> {
    vec![
        MixPreset {
            name: "HNO3 · 5m30s · Ultrasonic".to_string(),
            mode: "single".to_string(),
            chemical: "HNO3".to_string(),
            components: vec![],
            method: "ULTRASONIC".to_string(),
            duration_min: "5".to_string(),
            duration_sec: "30".to_string(),
        },
        MixPreset {
            name: "50% HCl + 50% HNO3 · 1m · NIL".to_string(),
            mode: "mix".to_string(),
            chemical: String::new(),
            components: vec![
                MixComponent { chemical: "HCl".to_string(), parts: 50 },
                MixComponent { chemical: "HNO3".to_string(), parts: 50 },
            ],
            method: "NIL".to_string(),
            duration_min: "1".to_string(),
            duration_sec: String::new(),
        },
    ]
}

fn load_presets() -> Vec<MixPreset> {
    match std::fs::read_to_string(MIX_PRESETS_FILE) {
        Ok(s) => serde_json::from_str(&s).unwrap_or_else(|_| default_presets()),
        Err(_) => default_presets(),
    }
}

fn save_presets(presets: &[MixPreset]) {
    if let Ok(s) = serde_json::to_string_pretty(presets) {
        let _ = std::fs::write(MIX_PRESETS_FILE, s);
    }
}
