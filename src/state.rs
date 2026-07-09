use std::sync::Arc;

use crate::catalog::catalog::ChemicalCatalog;
use crate::device::device::Device;
use crate::jobs::store::JobStore;
use crate::lims::repository::LimsRepository;

/// Shared application state. The data sources are held behind trait objects so
/// the concrete driver (tiberius now; a future sqlx impl; the in-memory mock)
/// is interchangeable without touching the RMF2/REST-facing code.
#[derive(Clone)]
pub struct AppState {
    pub lims: Arc<dyn LimsRepository>,
    pub jobs: Arc<dyn JobStore>,
    pub device: Arc<dyn Device>,
    pub catalog: Arc<dyn ChemicalCatalog>,
}
