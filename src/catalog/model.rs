use serde::{Deserialize, Serialize};

/// A selectable chemical/reagent in the catalog. `category` is optional and
/// reserved for future grouping; the UI currently uses `name`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Chemical {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub category: Option<String>,
}

impl Chemical {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            category: None,
        }
    }
}
