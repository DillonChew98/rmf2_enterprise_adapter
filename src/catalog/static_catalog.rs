use async_trait::async_trait;
use tracing::info;

use crate::catalog::catalog::ChemicalCatalog;
use crate::catalog::model::Chemical;

const DEFAULT_CHEMICALS: &[&str] = &[
    "BOE",
    "HCl",
    "HNO3",
    "HF",
    "Poly etch (MAE)",
    "Choline hydroxide",
    "H2SO4",
    "H2O2",
    "H2O",
];

/// Chemical catalog backed by a plain text file (one name per line, `#`
/// comments allowed), falling back to a built-in default list. Editable
/// without rebuilding — change the file and restart; the UI re-fetches.
pub struct StaticChemicalCatalog {
    chemicals: Vec<Chemical>,
}

impl StaticChemicalCatalog {
    pub fn from_file_or_default(path: &str) -> Self {
        let chemicals = match std::fs::read_to_string(path) {
            Ok(contents) => {
                let parsed = parse_lines(&contents);
                if parsed.is_empty() {
                    info!(path, "chemical catalog file empty; using built-in defaults");
                    default_chemicals()
                } else {
                    info!(path, count = parsed.len(), "chemical catalog loaded from file");
                    parsed
                }
            }
            Err(_) => {
                info!(path, "no chemical catalog file; using built-in defaults");
                default_chemicals()
            }
        };
        Self { chemicals }
    }
}

fn parse_lines(contents: &str) -> Vec<Chemical> {
    contents
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty() && !l.starts_with('#'))
        .map(Chemical::new)
        .collect()
}

fn default_chemicals() -> Vec<Chemical> {
    DEFAULT_CHEMICALS.iter().map(|c| Chemical::new(*c)).collect()
}

#[async_trait]
impl ChemicalCatalog for StaticChemicalCatalog {
    async fn list(&self) -> anyhow::Result<Vec<Chemical>> {
        Ok(self.chemicals.clone())
    }
}
