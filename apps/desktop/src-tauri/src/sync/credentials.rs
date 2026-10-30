use std::sync::Arc;

use store_http::{Credentials, Error, Result};
use time_core::sync::Uuid;

use super::api::ApiError;
use super::config::SyncConfig;
use super::session::Session;

/// The bearer tokens of one sync cycle: the signed-in access token for
/// Push, and this client's sync token for Pull and Pokes.
pub struct SessionCredentials {
    pub session: Arc<Session>,
    pub config: SyncConfig,
    pub client_id: Uuid,
}

/// A refused sign-in reads like the server's own `unauthenticated`, so the
/// cycle asks the user to sign in again; anything else is retried.
fn refused(error: ApiError) -> Error {
    match error {
        ApiError::Unauthorized => Error::Rpc {
            code: "unauthenticated".into(),
            message: error.to_string(),
        },
        other => Error::Credentials(other.to_string()),
    }
}

impl Credentials for SessionCredentials {
    fn product_token(&self) -> Result<String> {
        self.session.access_token(&self.config).map_err(refused)
    }

    fn sync_token(&self) -> Result<String> {
        self.session
            .grant(&self.config, self.client_id)
            .map(|grant| grant.token)
            .map_err(refused)
    }
}
