use axum::{Json, Router, extract::State, http::StatusCode, routing::get};

use crate::api::{ApiResult, error_response};
use crate::catalog::model::Chemical;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new().route("/api/chemicals", get(list_chemicals))
}

/// GET /api/chemicals — the selectable chemical catalog for the Job Input form.
async fn list_chemicals(State(state): State<AppState>) -> ApiResult<Vec<Chemical>> {
    let chemicals = state.catalog.list().await.map_err(|e| {
        error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("catalog error: {e}"),
        )
    })?;
    Ok((StatusCode::OK, Json(chemicals)))
}
