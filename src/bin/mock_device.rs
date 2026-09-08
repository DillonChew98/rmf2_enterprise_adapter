// Mock delayering machine. Speaks the RMF2 device contract over MQTT:
//   publishes `connection` (heartbeat) and `state` (1 Hz),
//   consumes `request` (a job) and executes it deterministically.
// While running a job it ignores new requests — the authoritative busy guard.

use std::collections::VecDeque;
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
    ChemicalStep, DelayeringJobRequest, MixComponent, RunJob,
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
    // Pushed job orders wait here until the machine is free (FIFO). They run
    // ahead of the ambient demo jobs so operator-submitted orders complete.
    let queue = Arc::new(Mutex::new(VecDeque::<RunJob>::new()));

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
        let queue = queue.clone();
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
                // A queued operator order runs immediately; otherwise fall back to
                // an ambient demo job after a short idle gap.
                if let Some(order) = queue.lock().expect("queue mutex poisoned").pop_front() {
                    idle_secs = 0;
                    exec.lock().expect("executor mutex poisoned").try_submit(&order);
                    info!(job = %order.job_number, order = %order.job_order, "running queued order");
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
                    .subscribe(topics.recipes_save.clone(), QoS::AtMostOnce)
                    .await;
                publish_connection(&client, &topics, &device_id).await;
                let snapshot = presets.lock().expect("presets mutex poisoned").clone();
                publish_recipes(&client, &topics, &snapshot).await;
                info!("device online; subscribed to request + recipes/save");
            }
            Ok(Event::Incoming(Packet::Publish(p))) if p.topic == topics.recipes_save => {
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
                        publish_recipes(&client, &topics, &snapshot).await;
                        info!(recipe = %preset.name, "recipe saved");
                    }
                    Err(e) => warn!(error = %e, "bad recipe-save payload"),
                }
            }
            Ok(Event::Incoming(Packet::Publish(p))) if p.topic == topics.request => {
                match serde_json::from_slice::<DelayeringJobRequest>(&p.payload) {
                    Ok(order) => {
                        // Split the order into its per-port jobs and queue each —
                        // the runner starts them as the machine frees up.
                        let run_jobs = order.into_run_jobs();
                        info!(count = run_jobs.len(), "order queued");
                        let mut q = queue.lock().expect("queue mutex poisoned");
                        for rj in run_jobs {
                            q.push_back(rj);
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
        connection_state: 1, // 1=ONLINE
    };
    if let Ok(bytes) = serde_json::to_vec(&payload) {
        let _ = client
            .publish(topics.connection.clone(), QoS::AtLeastOnce, true, bytes)
            .await;
    }
}

// The device's mix presets are published retained so the controller gets the
// current list as soon as it subscribes.
async fn publish_recipes(client: &AsyncClient, topics: &MachineTopics, presets: &[MixPreset]) {
    if let Ok(bytes) = serde_json::to_vec(presets) {
        let _ = client
            .publish(topics.recipes.clone(), QoS::AtLeastOnce, true, bytes)
            .await;
    }
}

// A small set of ambient demo jobs so the dashboard always has something to
// show. Step durations are clamped to a few seconds by the executor.
fn demo_jobs() -> Vec<RunJob> {
    // method codes: 1=NIL, 2=ULTRASONIC, 3=HEATED_PLATE. mode: 1=single, 2=mix.
    // chemical codes: 1=HNO3, 2=HF, 3=HCl, 4=MAE, 5=BOE, 6=Choline.
    let single = |chemical: i64, method: i64, secs: i64| ChemicalStep {
        recipe_name: String::new(),
        mode: 1,
        chemical,
        components: vec![],
        method,
        duration_sec: secs,
    };
    let mix = |a: i64, b: i64, method: i64, secs: i64| ChemicalStep {
        recipe_name: String::new(),
        mode: 2,
        chemical: 0,
        components: vec![
            MixComponent { chemical: a, percent: 50 },
            MixComponent { chemical: b, percent: 50 },
        ],
        method,
        duration_sec: secs,
    };
    // Ambient jobs have no operator order id.
    let job = |number: &str, port: &str, steps: Vec<ChemicalStep>| RunJob {
        job_order: String::new(),
        port: port.to_string(),
        job_number: number.to_string(),
        steps,
    };
    vec![
        job(
            "J-100482",
            "1",
            vec![
                single(1, 2, 330),   // HNO3, ULTRASONIC
                mix(3, 1, 1, 60),    // HCl + HNO3, NIL
            ],
        ),
        job(
            "J-100483",
            "3",
            vec![
                single(5, 1, 120),   // BOE, NIL
                single(2, 2, 5),     // HF, ULTRASONIC
            ],
        ),
        job(
            "J-100484",
            "4",
            vec![single(6, 3, 180)], // Choline, HEATED_PLATE
        ),
    ]
}

fn default_presets() -> Vec<MixPreset> {
    vec![
        MixPreset {
            name: "HNO3 etch".to_string(),
            mode: 1,
            chemical: 1, // HNO3
            components: vec![],
            method: 2, // ULTRASONIC
            duration_sec: 330,
        },
        MixPreset {
            name: "HCl + HNO3 mix".to_string(),
            mode: 2,
            chemical: 0,
            components: vec![
                MixComponent { chemical: 3, percent: 50 }, // HCl
                MixComponent { chemical: 1, percent: 50 }, // HNO3
            ],
            method: 1, // NIL
            duration_sec: 60,
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
