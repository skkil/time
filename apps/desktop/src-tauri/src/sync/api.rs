use serde::Deserialize;
use serde_json::json;
use time_core::sync::Uuid;

use super::auth::claims;

/// The server's answer to `POST /api/v1/sync/token`: a store token for
/// Pull and Pokes, and where the two halves of the protocol live.
#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncGrant {
    pub token: String,
    /// Unix seconds.
    pub expires_at: i64,
    pub store_url: String,
    pub push_url: String,
}

impl SyncGrant {
    /// The account the token is for: its `sub`, the store scope.
    pub fn scope(&self) -> Option<Uuid> {
        claims::decode(&self.token)?.sub?.parse().ok()
    }
}

#[derive(Debug, PartialEq)]
pub enum ApiError {
    /// The access token was refused; sign in again.
    Unauthorized,
    /// The client id belongs to another account.
    Conflict,
    /// The server couldn't be reached or failed.
    Unavailable(String),
}

impl std::fmt::Display for ApiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Unauthorized => f.write_str("The sign-in expired. Sign in again."),
            Self::Conflict => f.write_str("This device belongs to another account."),
            Self::Unavailable(reason) => write!(f, "Couldn't reach the server: {reason}"),
        }
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Me {
    scope_id: Option<Uuid>,
}

fn endpoint(server_url: &str, path: &str) -> String {
    format!("{}{path}", server_url.trim_end_matches('/'))
}

fn status_error(status: u16, body: String) -> ApiError {
    match status {
        401 | 403 => ApiError::Unauthorized,
        409 => ApiError::Conflict,
        _ => ApiError::Unavailable(format!("HTTP {status} {body}")),
    }
}

/// A sync token for `client_id`, which the server claims for the caller's
/// account on first use.
pub fn sync_token(
    server_url: &str,
    access_token: &str,
    client_id: Uuid,
) -> Result<SyncGrant, ApiError> {
    let mut response = ureq::post(&endpoint(server_url, "/api/v1/sync/token"))
        .config()
        .http_status_as_error(false)
        .build()
        .header("Authorization", &format!("Bearer {access_token}"))
        .send_json(json!({ "clientId": client_id }))
        .map_err(|error| ApiError::Unavailable(error.to_string()))?;
    let status = response.status().as_u16();
    if status != 200 {
        let body = response.body_mut().read_to_string().unwrap_or_default();
        return Err(status_error(status, body));
    }
    response
        .body_mut()
        .read_json()
        .map_err(|error| ApiError::Unavailable(error.to_string()))
}

/// The store scope of the signed-in account: `scopeId` from `/api/v1/me`
/// when the server reports it, else the `sub` of a token issued for a
/// fresh client id (a device bound to another account can't use its own).
pub fn scope_of(server_url: &str, access_token: &str) -> Result<Uuid, ApiError> {
    let me = ureq::get(&endpoint(server_url, "/api/v1/me"))
        .header("Authorization", &format!("Bearer {access_token}"))
        .call()
        .ok()
        .and_then(|mut response| response.body_mut().read_json::<Me>().ok());
    if let Some(scope) = me.and_then(|me| me.scope_id) {
        return Ok(scope);
    }
    sync_token(server_url, access_token, Uuid::now_v7())?
        .scope()
        .ok_or_else(|| ApiError::Unavailable("the sync token names no account".into()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_grant_names_its_account() {
        let scope = Uuid::now_v7();
        let grant = SyncGrant {
            token: claims::encode(&json!({ "sub": scope.to_string(), "exp": 1 })),
            expires_at: 1,
            store_url: "http://localhost:8091".into(),
            push_url: "http://localhost:8080".into(),
        };
        assert_eq!(grant.scope(), Some(scope));
        let parsed: SyncGrant = serde_json::from_value(json!({
            "token": "t", "expiresAt": 5, "storeUrl": "s", "pushUrl": "p"
        }))
        .unwrap();
        assert_eq!(parsed.expires_at, 5);
    }

    #[test]
    fn maps_refusals() {
        assert_eq!(status_error(401, String::new()), ApiError::Unauthorized);
        assert_eq!(status_error(409, String::new()), ApiError::Conflict);
        assert!(matches!(
            status_error(500, String::new()),
            ApiError::Unavailable(_)
        ));
    }
}
