use std::sync::Arc;

use axum::{Json, Router, http::StatusCode, routing::get};
use tower_http::cors::CorsLayer;
use tracing::info;

use rmf2_enterprise_adapter::api::{self, ApiResult};
use rmf2_enterprise_adapter::catalog::catalog::ChemicalCatalog;
use rmf2_enterprise_adapter::catalog::static_catalog::StaticChemicalCatalog;
use rmf2_enterprise_adapter::config::{Config, LimsBackend};
use rmf2_enterprise_adapter::device::device::Device;
use rmf2_enterprise_adapter::device::mqtt_device::MqttDevice;
use rmf2_enterprise_adapter::jobs::memory_store::MemoryJobStore;
use rmf2_enterprise_adapter::jobs::store::JobStore;
use rmf2_enterprise_adapter::lims::mock_repo::MockLimsRepository;
use rmf2_enterprise_adapter::lims::repository::LimsRepository;
use rmf2_enterprise_adapter::lims::tiberius_repo::TiberiusLimsRepository;
use rmf2_enterprise_adapter::state::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();
    dotenvy::dotenv().ok();

    let cfg = Config::from_env();

    // LIMS backend behind the trait object — the swap point.
    let lims: Arc<dyn LimsRepository> = match cfg.lims_backend {
        LimsBackend::Mock => {
            info!("LIMS backend: mock (in-memory)");
            Arc::new(MockLimsRepository::new())
        }
        LimsBackend::Tiberius => {
            info!(
                host = %cfg.mssql.host,
                port = cfg.mssql.port,
                database = %cfg.mssql.database,
                "LIMS backend: tiberius (SQL Server)"
            );
            let repo = TiberiusLimsRepository::connect(&cfg.mssql)
                .await
                .map_err(|e| {
                    tracing::error!(
                        host = %cfg.mssql.host,
                        port = cfg.mssql.port,
                        "Could not connect to the LIMS as SQL Server: {e:#}. \
                         Check host/port, the login, and the firewall. NOTE: this adapter \
                         speaks ONLY Microsoft SQL Server (TDS protocol). If the LIMS is \
                         actually PostgreSQL, MySQL, Oracle, etc., it cannot connect here — \
                         that requires a different LimsRepository implementation (a code \
                         change), not just new settings.",
                    );
                    e
                })?;
            Arc::new(repo)
        }
    };

    let job_store: Arc<dyn JobStore> = Arc::new(MemoryJobStore::new());

    // Device link over MQTT (connection/state/request). Reconnects on its own,
    // so the controller starts even if the broker/device isn't up yet.
    let device: Arc<dyn Device> = Arc::new(MqttDevice::new(&cfg.mqtt, "enterprise-adapter"));
    info!(
        host = %cfg.mqtt.host,
        port = cfg.mqtt.port,
        machine = %format!("{}/{}", cfg.mqtt.manufacturer, cfg.mqtt.device_id),
        "device link: MQTT"
    );

    // Chemical catalog (file-backed, editable; defaults built in).
    let catalog_file =
        std::env::var("CHEMICALS_FILE").unwrap_or_else(|_| "chemicals.txt".to_string());
    let catalog: Arc<dyn ChemicalCatalog> =
        Arc::new(StaticChemicalCatalog::from_file_or_default(&catalog_file));

    let state = AppState {
        lims,
        jobs: job_store,
        device,
        catalog,
    };

    let app = Router::new()
        .route("/health", get(health))
        .merge(api::lims::router())
        .merge(api::jobs::router())
        .merge(api::machine::router())
        .merge(api::catalog::router())
        .merge(api::mixes::router())
        .with_state(state)
        .layer(CorsLayer::permissive());

    let listener = tokio::net::TcpListener::bind(&cfg.bind_addr).await?;
    info!("rmf2_enterprise_adapter listening on http://{}", cfg.bind_addr);
    axum::serve(listener, app).await?;

    Ok(())
}

async fn health() -> ApiResult<serde_json::Value> {
    Ok((StatusCode::OK, Json(serde_json::json!({ "status": "OK" }))))
}
