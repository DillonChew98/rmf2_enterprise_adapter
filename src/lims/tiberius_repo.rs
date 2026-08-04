use std::collections::HashSet;

use anyhow::{Context, Result, anyhow};
use async_trait::async_trait;
use bb8::Pool;
use bb8_tiberius::ConnectionManager;
use chrono::{NaiveDateTime, TimeZone, Utc};
use tiberius::{AuthMethod, Config};
use tracing::{info, warn};

use crate::config::{MssqlAuth, MssqlConfig};
use crate::lims::model::LimsJob;
use crate::lims::repository::LimsRepository;

/// Tables + key columns the LIMS query depends on. Checked at startup so a
/// schema mismatch is reported loudly before any request is made.
const EXPECTED_SCHEMA: &[(&str, &[&str])] = &[
    ("Entity", &["pkGlobalEntityID", "EntityTypeID", "DisplayName"]),
    (
        "EntityLinks",
        &["RelatedEntityID", "fkEntityRelationshipID", "EntityID"],
    ),
    ("JobRecipeView", &["pkID", "JobNumber"]),
    ("Job6Custom", &["JobNumber", "Type", "XTime", "Status"]),
];

/// The user's LIMS query, verbatim T-SQL — the single source of truth. Compiled
/// in and executed unmodified, so pointing at the real LIMS needs only a new
/// connection string.
const LIMS_JOBS_SQL: &str = include_str!("../../sql/lims_jobs.sql");

pub struct TiberiusLimsRepository {
    pool: Pool<ConnectionManager>,
}

impl TiberiusLimsRepository {
    pub async fn connect(cfg: &MssqlConfig) -> Result<Self> {
        let mut config = Config::new();
        config.host(&cfg.host);
        config.port(cfg.port);
        config.database(&cfg.database);
        // Authentication:
        //   Sql        -> username/password (any platform).
        //   Integrated -> SSPI as the process's Windows account (Windows build
        //                 only). Run the adapter as the domain service account;
        //                 no username/password is used or stored.
        match cfg.auth {
            MssqlAuth::Sql => {
                config.authentication(AuthMethod::sql_server(&cfg.user, &cfg.password));
            }
            MssqlAuth::Integrated => {
                #[cfg(windows)]
                {
                    config.authentication(AuthMethod::Integrated);
                }
                #[cfg(not(windows))]
                {
                    anyhow::bail!(
                        "MSSQL_AUTH=integrated (Windows Integrated Auth) requires a Windows \
                         build running as the domain service account. This is a non-Windows \
                         build — use MSSQL_AUTH=sql with a SQL Server login instead."
                    );
                }
            }
        }
        // TLS verification (trust_cert and trust_cert_ca are mutually exclusive):
        //   trust_cert = true  -> accept any server cert (encrypted, NOT verified)
        //   MSSQL_CA_CERT set   -> verify against this CA (e.g. an internal CA)
        //   neither             -> verify against the system trust store (public CAs)
        if cfg.trust_cert {
            config.trust_cert();
        } else if let Some(ca) = &cfg.ca_cert_path {
            config.trust_cert_ca(ca.as_str());
        }

        let manager = ConnectionManager::new(config);
        let pool = Pool::builder()
            .max_size(8)
            .build(manager)
            .await
            .context("building mssql connection pool")?;

        // Fail fast if the LIMS is unreachable at startup.
        pool.get()
            .await
            .context("connecting to mssql at startup")?;
        info!(
            host = %cfg.host,
            port = cfg.port,
            database = %cfg.database,
            user = %cfg.user,
            "connected to LIMS (SQL Server)"
        );

        // Report whether the query's tables/columns exist in this schema.
        preflight_schema(&pool).await;

        Ok(Self { pool })
    }
}

/// Check `INFORMATION_SCHEMA` for every table/column the LIMS query needs and
/// log a clear pass/fail report. Non-fatal — it only diagnoses. A missing table
/// or column here explains a query that errors or returns nothing.
async fn preflight_schema(pool: &Pool<ConnectionManager>) {
    let mut conn = match pool.get().await {
        Ok(c) => c,
        Err(e) => {
            warn!(error = format!("{e:#}"), "schema preflight skipped: no connection");
            return;
        }
    };

    let sql = "SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS \
               WHERE TABLE_NAME IN ('Entity','EntityLinks','JobRecipeView','Job6Custom')";
    let rows = match conn.simple_query(sql).await {
        Ok(s) => match s.into_first_result().await {
            Ok(r) => r,
            Err(e) => {
                warn!(error = format!("{e:#}"), "schema preflight query failed");
                return;
            }
        },
        Err(e) => {
            warn!(error = format!("{e:#}"), "schema preflight query failed");
            return;
        }
    };

    // Set of "table.column" (lowercased) actually present in the LIMS.
    let mut present: HashSet<String> = HashSet::new();
    let mut tables: HashSet<String> = HashSet::new();
    for row in &rows {
        let t: Option<&str> = row.get("TABLE_NAME");
        let c: Option<&str> = row.get("COLUMN_NAME");
        if let (Some(t), Some(c)) = (t, c) {
            tables.insert(t.to_lowercase());
            present.insert(format!("{}.{}", t.to_lowercase(), c.to_lowercase()));
        }
    }

    let mut problems = 0;
    for (table, cols) in EXPECTED_SCHEMA {
        if !tables.contains(&table.to_lowercase()) {
            problems += 1;
            warn!(
                table = *table,
                "LIMS schema check: table NOT FOUND (missing, or the login lacks permission to see it)"
            );
            continue;
        }
        let missing: Vec<&str> = cols
            .iter()
            .copied()
            .filter(|c| !present.contains(&format!("{}.{}", table.to_lowercase(), c.to_lowercase())))
            .collect();
        if missing.is_empty() {
            info!(table = *table, "LIMS schema check: OK");
        } else {
            problems += 1;
            warn!(
                table = *table,
                missing_columns = missing.join(", "),
                "LIMS schema check: table present but columns MISSING"
            );
        }
    }

    if problems == 0 {
        info!("LIMS schema check: all expected tables and columns present");
    } else {
        warn!(
            issues = problems,
            "LIMS schema check found {problems} issue(s) — the query in sql/lims_jobs.sql \
             likely needs adapting to this LIMS's schema (see warnings above)"
        );
    }
}

#[async_trait]
impl LimsRepository for TiberiusLimsRepository {
    async fn list_jobs(&self) -> Result<Vec<LimsJob>> {
        let mut conn = self
            .pool
            .get()
            .await
            .context("getting mssql connection from pool")?;

        let stream = conn
            .simple_query(LIMS_JOBS_SQL)
            .await
            .context("executing LIMS query")?;

        let rows = stream
            .into_first_result()
            .await
            .context("collecting LIMS rows")?;

        let jobs: Vec<LimsJob> = rows
            .iter()
            .map(row_to_job)
            .collect::<Result<_>>()
            .context("mapping LIMS rows (column alias mismatch?)")?;

        if jobs.is_empty() {
            warn!(
                "LIMS query returned 0 rows — connection + schema are fine but nothing matched. \
                 Check the filters in sql/lims_jobs.sql (Status IN ('A','P'), Type = 'SEM') and \
                 the entity-type / relationship IDs against this LIMS's data."
            );
        } else {
            info!(count = jobs.len(), "LIMS query returned {} job(s)", jobs.len());
        }
        Ok(jobs)
    }

    async fn get_job(&self, job_number: &str) -> Result<Option<LimsJob>> {
        Ok(self
            .list_jobs()
            .await?
            .into_iter()
            .find(|j| j.job_number == job_number))
    }
}

/// Map a result row by the T-SQL column aliases.
fn row_to_job(row: &tiberius::Row) -> Result<LimsJob> {
    let job_number: &str = row
        .get("Job Number")
        .ok_or_else(|| anyhow!("LIMS row missing 'Job Number'"))?;
    let analysis_type: &str = row.get("Analysis Type").unwrap_or_default();
    let status: &str = row.get("Status").unwrap_or_default();
    let stain: Option<&str> = row.get("Stain");
    let submission_time: Option<NaiveDateTime> = row.get("Submission Time");

    Ok(LimsJob {
        job_number: job_number.to_string(),
        analysis_type: analysis_type.to_string(),
        submission_time: submission_time.map(|ndt| Utc.from_utc_datetime(&ndt)),
        status: status.to_string(),
        stain: stain.map(|s| s.to_string()),
    })
}
