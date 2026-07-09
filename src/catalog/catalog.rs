use async_trait::async_trait;

use crate::catalog::model::Chemical;

/// The chemical catalog seam. The REST layer depends only on this trait, so the
/// backing source (a static/file catalog now; a DB table later) is swappable
/// without changing any UI-facing code — same pattern as `LimsRepository`.
#[async_trait]
pub trait ChemicalCatalog: Send + Sync {
    async fn list(&self) -> anyhow::Result<Vec<Chemical>>;
}
