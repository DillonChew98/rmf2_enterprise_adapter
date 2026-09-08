use async_trait::async_trait;
use tracing::info;

use crate::catalog::catalog::ChemicalCatalog;
use crate::catalog::model::Chemical;

// The finalized 8-chemical catalog. Position = chemical code (line 1 = code 1).
const DEFAULT_CHEMICALS: &[&str] = &[
    "Nitric Acid 70% (HNO3)",
    "Hydrofluoric Acid 49% (HF)",
    "Hydrochloric Acid 37% (HCl)",
    "95% Poly Etch MAE (MAE)",
    "BOE 7:1 (BOE)",
    "Choline Hydroxide",
    "Spare 1",
    "Spare 2",
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
    // Position determines the chemical code: first listed = code 1, etc.
    contents
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty() && !l.starts_with('#'))
        .enumerate()
        .map(|(i, l)| Chemical::new((i + 1) as u8, l))
        .collect()
}

fn default_chemicals() -> Vec<Chemical> {
    DEFAULT_CHEMICALS
        .iter()
        .enumerate()
        .map(|(i, c)| Chemical::new((i + 1) as u8, *c))
        .collect()
}

#[async_trait]
impl ChemicalCatalog for StaticChemicalCatalog {
    async fn list(&self) -> anyhow::Result<Vec<Chemical>> {
        Ok(self.chemicals.clone())
    }
}
