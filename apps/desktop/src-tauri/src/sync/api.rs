use serde::Deserialize;
use serde_json::json;
use time_core::sync::Uuid;

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
    scope_id: Uuid,
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

/// The store scope of the signed-in account: `scopeId` from `/api/v1/me`.
pub fn scope_of(server_url: &str, access_token: &str) -> Result<Uuid, ApiError> {
    let mut response = ureq::get(&endpoint(server_url, "/api/v1/me"))
        .config()
        .http_status_as_error(false)
        .build()
        .header("Authorization", &format!("Bearer {access_token}"))
        .call()
        .map_err(|error| ApiError::Unavailable(error.to_string()))?;
    let status = response.status().as_u16();
    if status != 200 {
        let body = response.body_mut().read_to_string().unwrap_or_default();
        return Err(status_error(status, body));
    }
    response
        .body_mut()
        .read_json::<Me>()
        .map(|me| me.scope_id)
        .map_err(|error| ApiError::Unavailable(error.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_the_grant_and_the_account_scope() {
        let parsed: SyncGrant = serde_json::from_value(json!({
            "token": "t", "expiresAt": 5, "storeUrl": "s", "pushUrl": "p"
        }))
        .unwrap();
        assert_eq!(parsed.expires_at, 5);
        let scope = Uuid::now_v7();
        let me: Me = serde_json::from_value(json!({
            "id": 1, "timeZone": "UTC", "scopeId": scope.to_string()
        }))
        .unwrap();
        assert_eq!(me.scope_id, scope);
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
