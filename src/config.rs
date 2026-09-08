use std::env;

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum LimsBackend {
    /// Real SQL Server LIMS via the tiberius driver (runs the verbatim T-SQL).
    Tiberius,
    /// In-memory seed — runs without any database.
    Mock,
}

/// How the adapter authenticates to SQL Server.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MssqlAuth {
    /// SQL Server login: username + password (works on any platform).
    Sql,
    /// Windows Integrated Auth as the account the process runs under (SSPI).
    /// Only available in a Windows build; the adapter must run as the domain
    /// service account. No username/password stored.
    Integrated,
}

#[derive(Clone, Debug)]
pub struct MssqlConfig {
    pub host: String,
    pub port: u16,
    pub database: String,
    pub auth: MssqlAuth,
    pub user: String,
    pub password: String,
    pub trust_cert: bool,
    /// Path to a CA certificate (PEM) to verify the server against — e.g. an
    /// internal/corporate CA. Ignored when `trust_cert` is true.
    pub ca_cert_path: Option<String>,
}

#[derive(Clone, Debug)]
pub struct MqttConfig {
    pub host: String,
    pub port: u16,
    pub manufacturer: String,
    pub device_id: String,
}

#[derive(Clone, Debug)]
pub struct Config {
    pub bind_addr: String,
    pub lims_backend: LimsBackend,
    pub mssql: MssqlConfig,
    pub mqtt: MqttConfig,
}

impl Config {
    pub fn from_env() -> Self {
        let bind_addr =
            env::var("BIND_ADDR").unwrap_or_else(|_| "0.0.0.0:7900".to_string());

        let lims_backend = match env::var("LIMS_BACKEND")
            .unwrap_or_else(|_| "tiberius".to_string())
            .to_lowercase()
            .as_str()
        {
            "mock" => LimsBackend::Mock,
            _ => LimsBackend::Tiberius,
        };

        let mssql = MssqlConfig {
            host: env::var("MSSQL_HOST").unwrap_or_else(|_| "localhost".to_string()),
            port: env::var("MSSQL_PORT")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(1433),
            database: env::var("MSSQL_DATABASE").unwrap_or_else(|_| "LIMS".to_string()),
            // "sql" (default) = username/password; "integrated"/"windows" = SSPI
            // as the process's Windows account (Windows build only).
            auth: match env::var("MSSQL_AUTH")
                .unwrap_or_default()
                .to_lowercase()
                .as_str()
            {
                "integrated" | "windows" => MssqlAuth::Integrated,
                _ => MssqlAuth::Sql,
            },
            user: env::var("MSSQL_USER").unwrap_or_else(|_| "sa".to_string()),
            password: env::var("MSSQL_PASSWORD")
                .unwrap_or_else(|_| "Your_strong_Pass123".to_string()),
            // Default to trusting the dev container's self-signed cert.
            trust_cert: env::var("MSSQL_TRUST_CERT")
                .map(|v| v.to_lowercase() != "false")
                .unwrap_or(true),
            // Optional CA cert (PEM) to verify against when trust_cert=false.
            ca_cert_path: env::var("MSSQL_CA_CERT")
                .ok()
                .filter(|s| !s.trim().is_empty()),
        };

        let mqtt = MqttConfig {
            host: env::var("MQTT_HOST").unwrap_or_else(|_| "localhost".to_string()),
            port: env::var("MQTT_PORT")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(1883),
            manufacturer: env::var("MACHINE_MANUFACTURER")
                .unwrap_or_else(|_| "SankeiEagle".to_string()),
            device_id: env::var("MACHINE_DEVICE_ID")
                .unwrap_or_else(|_| "delayer-01".to_string()),
        };

        Self {
            bind_addr,
            lims_backend,
            mssql,
            mqtt,
        }
    }
}
