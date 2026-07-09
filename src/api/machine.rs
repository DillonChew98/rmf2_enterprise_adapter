use axum::{Json, Router, extract::State, http::StatusCode, routing::get};

use crate::api::ApiResult;
use crate::device::model::{MachineConnection, MachineState};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/machine/state", get(get_state))
        .route("/api/machine/connection", get(get_connection))
}

/// GET /api/machine/state — the device's live status (drives the Dashboard).
async fn get_state(State(state): State<AppState>) -> ApiResult<MachineState> {
    Ok((StatusCode::OK, Json(state.device.state().await)))
}

/// GET /api/machine/connection — device online/offline.
async fn get_connection(State(state): State<AppState>) -> ApiResult<MachineConnection> {
    Ok((StatusCode::OK, Json(state.device.connection().await)))
}
