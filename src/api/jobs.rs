use axum::{Json, Router, extract::State, http::StatusCode, routing::get};
use chrono::Utc;

use crate::api::{ApiResult, error_response};
use crate::device::device::SubmitOutcome;
use crate::jobs::model::DelayeringJobRequest;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/api/machine/request",
            get(list_requests).post(submit_request),
        )
        .route("/api/machine/request/previous", get(previous_request))
}

/// POST /api/machine/request — send a job to the device. The device accepts it
/// (202) and starts executing, or rejects it (409) if it is busy. Only accepted
/// jobs are stored (so "copy previous" reflects what actually ran).
async fn submit_request(
    State(state): State<AppState>,
    Json(mut req): Json<DelayeringJobRequest>,
) -> ApiResult<DelayeringJobRequest> {
    req.submitted_at = Some(Utc::now().to_rfc3339());

    match state.device.submit(&req).await {
        SubmitOutcome::Busy(reason) => Err(error_response(StatusCode::CONFLICT, reason)),
        SubmitOutcome::Unavailable(reason) => {
            Err(error_response(StatusCode::SERVICE_UNAVAILABLE, reason))
        }
        SubmitOutcome::Accepted => {
            let stored = state.jobs.submit(req).await.map_err(|e| {
                error_response(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("store error: {e}"),
                )
            })?;
            Ok((StatusCode::ACCEPTED, Json(stored)))
        }
    }
}

/// GET /api/machine/request/previous — the most recently submitted job.
async fn previous_request(
    State(state): State<AppState>,
) -> ApiResult<Option<DelayeringJobRequest>> {
    let prev = state.jobs.previous().await.map_err(|e| {
        error_response(StatusCode::INTERNAL_SERVER_ERROR, format!("store error: {e}"))
    })?;
    Ok((StatusCode::OK, Json(prev)))
}

/// GET /api/machine/request — all submitted jobs (most recent first).
async fn list_requests(
    State(state): State<AppState>,
) -> ApiResult<Vec<DelayeringJobRequest>> {
    let jobs = state.jobs.list().await.map_err(|e| {
        error_response(StatusCode::INTERNAL_SERVER_ERROR, format!("store error: {e}"))
    })?;
    Ok((StatusCode::OK, Json(jobs)))
}
