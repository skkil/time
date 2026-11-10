//! Connected calendars, which live in the account: the server connects and
//! reads them, and this desktop asks it on the signed-in person's behalf.

use serde::{Deserialize, Serialize};
use specta::Type;

use super::api::{ApiError, endpoint, status_error};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CalendarAccountView {
    pub id: String,
    pub provider: String,
    pub email: Option<String>,
    pub status: String,
    /// Unix seconds of the last read.
    #[specta(type = Option<specta_typescript::Number>)]
    pub synced_at: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CalendarStatusView {
    pub signed_in: bool,
    pub available: bool,
    pub accounts: Vec<CalendarAccountView>,
}

impl CalendarStatusView {
    pub fn signed_out() -> Self {
        Self {
            signed_in: false,
            available: false,
            accounts: Vec::new(),
        }
    }
}

#[derive(Deserialize)]
struct Status {
    available: bool,
    accounts: Vec<CalendarAccountView>,
}

#[derive(Deserialize)]
struct Link {
    url: String,
}

fn failed(error: ureq::Error) -> ApiError {
    ApiError::Unavailable(error.to_string())
}

fn read<T: serde::de::DeserializeOwned>(
    mut response: ureq::http::Response<ureq::Body>,
) -> Result<T, ApiError> {
    let status = response.status().as_u16();
    if !(200..300).contains(&status) {
        let body = response.body_mut().read_to_string().unwrap_or_default();
        return Err(status_error(status, body));
    }
    response
        .body_mut()
        .read_json()
        .map_err(|error| ApiError::Unavailable(error.to_string()))
}

pub fn status(server_url: &str, access_token: &str) -> Result<CalendarStatusView, ApiError> {
    let response = ureq::get(&endpoint(server_url, "/api/v1/calendar"))
        .config()
        .http_status_as_error(false)
        .build()
        .header("Authorization", &format!("Bearer {access_token}"))
        .call()
        .map_err(failed)?;
    let status: Status = read(response)?;
    Ok(CalendarStatusView {
        signed_in: true,
        available: status.available,
        accounts: status.accounts,
    })
}

/// Where to send the person to consent.
pub fn connect(server_url: &str, access_token: &str) -> Result<String, ApiError> {
    let response = ureq::post(&endpoint(server_url, "/api/v1/calendar/google/connect"))
        .config()
        .http_status_as_error(false)
        .build()
        .header("Authorization", &format!("Bearer {access_token}"))
        .send_empty()
        .map_err(failed)?;
    read::<Link>(response).map(|link| link.url)
}

pub fn disconnect(server_url: &str, access_token: &str, id: &str) -> Result<(), ApiError> {
    let mut response = ureq::delete(&endpoint(
        server_url,
        &format!("/api/v1/calendar/accounts/{id}"),
    ))
    .config()
    .http_status_as_error(false)
    .build()
    .header("Authorization", &format!("Bearer {access_token}"))
    .call()
    .map_err(failed)?;
    let status = response.status().as_u16();
    if (200..300).contains(&status) {
        return Ok(());
    }
    let body = response.body_mut().read_to_string().unwrap_or_default();
    Err(status_error(status, body))
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn reads_the_server_status() {
        let status: Status = serde_json::from_value(json!({
            "available": true,
            "accounts": [{
                "id": "019a6c00-0000-7000-8000-0000000000a1",
                "provider": "google",
                "email": "ada@example.com",
                "status": "reauth",
                "syncedAt": 1_793_000_000
            }]
        }))
        .unwrap();
        assert!(status.available);
        assert_eq!(status.accounts[0].status, "reauth");
        assert_eq!(status.accounts[0].synced_at, Some(1_793_000_000));
        assert!(!CalendarStatusView::signed_out().signed_in);
    }
}
