use std::sync::{Arc, Mutex};
use std::time::Duration;

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use rumqttc::{AsyncClient, Event, MqttOptions, Packet, QoS};
use tracing::{info, warn};

use crate::config::MqttConfig;
use crate::device::device::{Device, SubmitOutcome};
use crate::device::model::{
    ConnectionPayload, ConnectionStatus, MachineConnection, MachineState, MixPreset, SystemStatus,
};
use crate::device::topics::MachineTopics;
use crate::jobs::model::DelayeringJobRequest;

// A device `connection` older than this (while last reported ONLINE) is treated
// as CONNECTION_BROKEN — the RMF2 derived-staleness rule (§7.2.1).
const STALE_SECS: i64 = 15;

#[derive(Default)]
struct Cache {
    state: Option<MachineState>,
    conn_state: Option<String>,
    conn_at: Option<DateTime<Utc>>,
    presets: Vec<MixPreset>,
}

/// Controller-side device, talking to the real (mock) machine over MQTT using
/// the RMF2 connection/state/request contract. Subscribes to the device's
/// `connection` + `state`, caches the latest, and publishes jobs on `request`.
pub struct MqttDevice {
    client: AsyncClient,
    topics: MachineTopics,
    cache: Arc<Mutex<Cache>>,
}

impl MqttDevice {
    pub fn new(cfg: &MqttConfig, client_id: &str) -> Self {
        let topics = MachineTopics::new(&cfg.manufacturer, &cfg.device_id);

        let mut opts = MqttOptions::new(client_id, &cfg.host, cfg.port);
        opts.set_keep_alive(Duration::from_secs(5));
        let (client, mut eventloop) = AsyncClient::new(opts, 16);

        let cache = Arc::new(Mutex::new(Cache::default()));

        // Background: (re)subscribe on each connect, cache incoming payloads.
        let sub_client = client.clone();
        let sub_topics = topics.clone();
        let cache_bg = cache.clone();
        tokio::spawn(async move {
            loop {
                match eventloop.poll().await {
                    Ok(Event::Incoming(Packet::ConnAck(_))) => {
                        for topic in [&sub_topics.state, &sub_topics.connection, &sub_topics.mixes] {
                            let _ = sub_client.subscribe(topic.clone(), QoS::AtMostOnce).await;
                        }
                        info!("controller subscribed to device state + connection + mixes");
                    }
                    Ok(Event::Incoming(Packet::Publish(p))) => {
                        if p.topic == sub_topics.state {
                            match serde_json::from_slice::<MachineState>(&p.payload) {
                                Ok(st) => cache_bg.lock().unwrap().state = Some(st),
                                Err(e) => warn!(error = %e, "bad state payload"),
                            }
                        } else if p.topic == sub_topics.connection {
                            if let Ok(cp) =
                                serde_json::from_slice::<ConnectionPayload>(&p.payload)
                            {
                                let mut c = cache_bg.lock().unwrap();
                                c.conn_state = Some(cp.connection_state);
                                c.conn_at = Some(Utc::now());
                            }
                        } else if p.topic == sub_topics.mixes {
                            match serde_json::from_slice::<Vec<MixPreset>>(&p.payload) {
                                Ok(presets) => cache_bg.lock().unwrap().presets = presets,
                                Err(e) => warn!(error = %e, "bad mixes payload"),
                            }
                        }
                    }
                    Ok(_) => {}
                    Err(e) => {
                        warn!(error = %e, "mqtt eventloop error; retrying");
                        tokio::time::sleep(Duration::from_secs(1)).await;
                    }
                }
            }
        });

        Self {
            client,
            topics,
            cache,
        }
    }

    fn derive_connection(cache: &Cache) -> MachineConnection {
        let status = match (&cache.conn_state, cache.conn_at) {
            (Some(s), Some(at)) if s == "ONLINE" => {
                if (Utc::now() - at).num_seconds() < STALE_SECS {
                    ConnectionStatus::Online
                } else {
                    ConnectionStatus::ConnectionBroken
                }
            }
            (Some(_), _) => ConnectionStatus::Offline,
            _ => ConnectionStatus::Offline,
        };
        MachineConnection {
            status,
            received_at: cache.conn_at,
        }
    }
}

#[async_trait]
impl Device for MqttDevice {
    async fn submit(&self, job: &DelayeringJobRequest) -> SubmitOutcome {
        // Gate on the cached connection + state for immediate UI feedback; the
        // device is the authoritative guard (it ignores requests while busy).
        let (conn, busy, current) = {
            let c = self.cache.lock().unwrap();
            let conn = Self::derive_connection(&c);
            let busy = c
                .state
                .as_ref()
                .map(|s| s.system_status == SystemStatus::Running)
                .unwrap_or(false);
            let current = c
                .state
                .as_ref()
                .and_then(|s| s.current_job.clone())
                .unwrap_or_default();
            (conn, busy, current)
        };

        if conn.status != ConnectionStatus::Online {
            return SubmitOutcome::Unavailable("Delayering machine is offline".to_string());
        }
        if busy {
            return SubmitOutcome::Busy(format!(
                "Machine busy executing {current} — job rejected"
            ));
        }

        let payload = match serde_json::to_vec(job) {
            Ok(p) => p,
            Err(e) => return SubmitOutcome::Unavailable(format!("encode error: {e}")),
        };
        match self
            .client
            .publish(self.topics.request.clone(), QoS::AtMostOnce, false, payload)
            .await
        {
            Ok(()) => SubmitOutcome::Accepted,
            Err(e) => SubmitOutcome::Unavailable(format!("failed to publish request: {e}")),
        }
    }

    async fn state(&self) -> MachineState {
        self.cache
            .lock()
            .unwrap()
            .state
            .clone()
            .unwrap_or_else(MachineState::offline)
    }

    async fn connection(&self) -> MachineConnection {
        Self::derive_connection(&self.cache.lock().unwrap())
    }

    async fn mix_presets(&self) -> Vec<MixPreset> {
        self.cache.lock().unwrap().presets.clone()
    }

    async fn save_mix(&self, preset: &MixPreset) -> SubmitOutcome {
        let conn = { Self::derive_connection(&self.cache.lock().unwrap()) };
        if conn.status != ConnectionStatus::Online {
            return SubmitOutcome::Unavailable("Delayering machine is offline".to_string());
        }

        let payload = match serde_json::to_vec(preset) {
            Ok(p) => p,
            Err(e) => return SubmitOutcome::Unavailable(format!("encode error: {e}")),
        };
        match self
            .client
            .publish(self.topics.mixes_save.clone(), QoS::AtMostOnce, false, payload)
            .await
        {
            Ok(()) => {
                // Optimistic cache update; the device's republish reconciles.
                let mut c = self.cache.lock().unwrap();
                c.presets.retain(|m| m.name != preset.name);
                c.presets.push(preset.clone());
                SubmitOutcome::Accepted
            }
            Err(e) => SubmitOutcome::Unavailable(format!("failed to publish mix: {e}")),
        }
    }
}
