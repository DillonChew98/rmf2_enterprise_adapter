use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    routing::get,
};

use crate::api::{ApiResult, error_response};
use crate::lims::model::LimsJob;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/lims/jobs", get(list_jobs))
        .route("/api/lims/jobs/{job_number}", get(get_job))
}

/// GET /api/lims/jobs — runs the LIMS query and returns the open SEM jobs.
async fn list_jobs(State(state): State<AppState>) -> ApiResult<Vec<LimsJob>> {
    let jobs = state.lims.list_jobs().await.map_err(|e| {
        // `{e:#}` prints the full anyhow chain incl. the underlying SQL Server
        // error (e.g. "Invalid object name 'Job6Custom'"), not just the top layer.
        tracing::error!("GET /api/lims/jobs failed: {e:#}");
        error_response(StatusCode::BAD_GATEWAY, format!("LIMS query failed: {e:#}"))
    })?;
    Ok((StatusCode::OK, Json(jobs)))
}

/// GET /api/lims/jobs/{job_number} — single job lookup for the operator flow.
async fn get_job(
    State(state): State<AppState>,
    Path(job_number): Path<String>,
) -> ApiResult<LimsJob> {
    let job = state
        .lims
        .get_job(&job_number)
        .await
        .map_err(|e| {
            tracing::error!("GET /api/lims/jobs/{job_number} failed: {e:#}");
            error_response(StatusCode::BAD_GATEWAY, format!("LIMS query failed: {e:#}"))
        })?
        .ok_or_else(|| error_response(StatusCode::NOT_FOUND, "Job not found"))?;
    Ok((StatusCode::OK, Json(job)))
}
