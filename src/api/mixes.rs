use axum::{Json, Router, extract::State, http::StatusCode, routing::get};

use crate::api::{ApiResult, error_response};
use crate::device::device::SubmitOutcome;
use crate::device::model::MixPreset;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new().route("/api/mix-presets", get(list_mixes).post(save_mix))
}

/// GET /api/mix-presets — the device's saved mix recipes.
async fn list_mixes(State(state): State<AppState>) -> ApiResult<Vec<MixPreset>> {
    Ok((StatusCode::OK, Json(state.device.mix_presets().await)))
}

/// POST /api/mix-presets — ask the device to save a new mix.
async fn save_mix(
    State(state): State<AppState>,
    Json(preset): Json<MixPreset>,
) -> ApiResult<MixPreset> {
    if preset.name.trim().is_empty() {
        return Err(error_response(StatusCode::BAD_REQUEST, "Mix name is required"));
    }
    match state.device.save_mix(&preset).await {
        SubmitOutcome::Accepted => Ok((StatusCode::ACCEPTED, Json(preset))),
        SubmitOutcome::Unavailable(reason) => {
            Err(error_response(StatusCode::SERVICE_UNAVAILABLE, reason))
        }
        SubmitOutcome::Busy(reason) => Err(error_response(StatusCode::CONFLICT, reason)),
    }
}
