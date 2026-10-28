use std::sync::Mutex;

use time_core::sync::Uuid;

use super::api::{self, ApiError, SyncGrant};
use super::auth::claims::Claims;
use super::auth::oidc::{Oidc, now};
use super::auth::tokens::{TokenStore, Tokens};
use super::config::SyncConfig;

/// Renew a sync token this long before it expires.
const GRANT_MARGIN_SECONDS: i64 = 60;

/// The signed-in person on this desktop: their tokens (kept by a
/// [`TokenStore`], refreshed when they run out) and the sync token for
/// this device's client id.
pub struct Session {
    store: Box<dyn TokenStore>,
    tokens: Mutex<Option<Tokens>>,
    grant: Mutex<Option<(Uuid, SyncGrant)>>,
}

impl Session {
    pub fn new(store: Box<dyn TokenStore>) -> Self {
        let tokens = store.load();
        Self {
            store,
            tokens: Mutex::new(tokens),
            grant: Mutex::new(None),
        }
    }

    fn tokens(&self) -> std::sync::MutexGuard<'_, Option<Tokens>> {
        self.tokens
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    pub fn signed_in(&self) -> bool {
        self.tokens().is_some()
    }

    pub fn profile(&self) -> Option<Claims> {
        self.tokens().as_ref().map(Tokens::profile)
    }

    pub fn keep(&self, tokens: Tokens) -> Result<(), String> {
        self.store.save(&tokens)?;
        *self.tokens() = Some(tokens);
        self.forget_grant();
        Ok(())
    }

    pub fn sign_out(&self) -> Result<(), String> {
        *self.tokens() = None;
        self.forget_grant();
        self.store.clear()
    }

    /// A current access token, refreshed through the issuer when it is
    /// about to expire.
    pub fn access_token(&self, config: &SyncConfig) -> Result<String, ApiError> {
        let current = self.tokens().clone().ok_or(ApiError::Unauthorized)?;
        if !current.needs_refresh(now()) {
            return Ok(current.access_token);
        }
        let refreshed = Oidc::discover(config)
            .and_then(|oidc| oidc.refresh(&current))
            .map_err(|_| ApiError::Unauthorized)?;
        self.keep(refreshed.clone())
            .map_err(ApiError::Unavailable)?;
        Ok(refreshed.access_token)
    }

    pub fn forget_grant(&self) {
        *self
            .grant
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner()) = None;
    }

    /// The sync token for `client_id`, fetched again near its expiry or
    /// when the client id changed.
    pub fn grant(&self, config: &SyncConfig, client_id: Uuid) -> Result<SyncGrant, ApiError> {
        let mut grant = self
            .grant
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if let Some((client, current)) = grant.as_ref()
            && *client == client_id
            && current.expires_at - GRANT_MARGIN_SECONDS > now()
        {
            return Ok(current.clone());
        }
        let access = self.access_token(config)?;
        let fresh = api::sync_token(&config.server_url, &access, client_id)?;
        *grant = Some((client_id, fresh.clone()));
        Ok(fresh)
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;
    use crate::sync::auth::claims;
    use crate::sync::auth::tokens::MemoryStore;

    #[test]
    fn signing_out_forgets_the_tokens() {
        let session = Session::new(Box::new(MemoryStore::default()));
        assert!(!session.signed_in());
        session
            .keep(Tokens {
                access_token: "a".into(),
                refresh_token: None,
                id_token: Some(claims::encode(&json!({ "email": "ada@example.com" }))),
                expires_at: now() + 3_600,
            })
            .unwrap();
        assert!(session.signed_in());
        assert_eq!(
            session.profile().unwrap().email.as_deref(),
            Some("ada@example.com")
        );
        let config = SyncConfig {
            server_url: "http://127.0.0.1:9".into(),
            authority: "http://127.0.0.1:9".into(),
            client_id: "time-desktop".into(),
            audience: None,
        };
        assert_eq!(session.access_token(&config).unwrap(), "a");
        session.sign_out().unwrap();
        assert!(!session.signed_in());
        assert_eq!(session.access_token(&config), Err(ApiError::Unauthorized));
    }
}
