use anyhow::{Context, Result, anyhow};
use async_trait::async_trait;
use bb8::Pool;
use bb8_tiberius::ConnectionManager;
use chrono::{NaiveDateTime, TimeZone, Utc};
use tiberius::{AuthMethod, Config};

use crate::config::MssqlConfig;
use crate::lims::model::LimsJob;
use crate::lims::repository::LimsRepository;

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
        config.authentication(AuthMethod::sql_server(&cfg.user, &cfg.password));
        if cfg.trust_cert {
            config.trust_cert();
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

        Ok(Self { pool })
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

        rows.iter().map(row_to_job).collect()
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
