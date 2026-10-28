use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use specta::Type;
use time_core::{Result, device_settings};

const SERVER_KEY: &str = "sync_server_url";
const AUTHORITY_KEY: &str = "sync_auth_authority";
const CLIENT_KEY: &str = "sync_auth_client_id";
const AUDIENCE_KEY: &str = "sync_auth_audience";

const DEFAULT_SERVER: &str = match option_env!("SKKIL_SERVER_URL") {
    Some(url) => url,
    None => "http://localhost:8080",
};
const DEFAULT_AUTHORITY: &str = match option_env!("SKKIL_AUTH_AUTHORITY") {
    Some(url) => url,
    None => "http://localhost:8090/default",
};
const DEFAULT_CLIENT: &str = match option_env!("SKKIL_AUTH_CLIENT_ID") {
    Some(id) => id,
    None => "time-desktop",
};
const DEFAULT_AUDIENCE: &str = match option_env!("SKKIL_AUTH_AUDIENCE") {
    Some(audience) => audience,
    None => "time-api",
};

/// Where this desktop syncs and signs in: device settings, defaulting to
/// what the build was given (`SKKIL_SERVER_URL`, `SKKIL_AUTH_AUTHORITY`,
/// `SKKIL_AUTH_CLIENT_ID`, `SKKIL_AUTH_AUDIENCE`).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SyncConfig {
    pub server_url: String,
    pub authority: String,
    pub client_id: String,
    pub audience: Option<String>,
}

impl SyncConfig {
    pub fn load(conn: &Connection) -> Result<Self> {
        let read = |key: &str, default: &str| -> Result<String> {
            Ok(device_settings::read(conn, key)?.unwrap_or_else(|| default.to_owned()))
        };
        let audience = read(AUDIENCE_KEY, DEFAULT_AUDIENCE)?;
        Ok(Self {
            server_url: read(SERVER_KEY, DEFAULT_SERVER)?,
            authority: read(AUTHORITY_KEY, DEFAULT_AUTHORITY)?,
            client_id: read(CLIENT_KEY, DEFAULT_CLIENT)?,
            audience: Some(audience).filter(|audience| !audience.is_empty()),
        })
    }

    pub fn save(&self, conn: &Connection) -> Result<()> {
        let clean = |value: &str| value.trim().trim_end_matches('/').to_owned();
        device_settings::write(conn, SERVER_KEY, &clean(&self.server_url))?;
        device_settings::write(conn, AUTHORITY_KEY, &clean(&self.authority))?;
        device_settings::write(conn, CLIENT_KEY, self.client_id.trim())?;
        device_settings::write(
            conn,
            AUDIENCE_KEY,
            self.audience.as_deref().unwrap_or("").trim(),
        )
    }
}

#[cfg(test)]
mod tests {
    use time_core::sync::Engine;

    use super::*;

    #[test]
    fn defaults_until_changed_on_this_device() {
        let engine = Engine::in_memory().unwrap();
        let conn = engine.connection();
        let config = SyncConfig::load(conn).unwrap();
        assert_eq!(config.server_url, DEFAULT_SERVER);
        let changed = SyncConfig {
            server_url: " https://time.example.com/ ".into(),
            audience: None,
            ..config
        };
        changed.save(conn).unwrap();
        let loaded = SyncConfig::load(conn).unwrap();
        assert_eq!(loaded.server_url, "https://time.example.com");
        assert_eq!(loaded.audience, None);
    }
}
