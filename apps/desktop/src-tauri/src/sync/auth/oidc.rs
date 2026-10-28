use serde::Deserialize;
use url::Url;

use super::pkce::Pkce;
use super::tokens::Tokens;
use crate::sync::config::SyncConfig;

const SCOPE: &str = "openid profile email offline_access";

#[derive(Debug, Clone, Deserialize)]
pub struct Discovery {
    pub authorization_endpoint: String,
    pub token_endpoint: String,
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    id_token: Option<String>,
    expires_in: Option<i64>,
}

/// An OpenID Connect public client: authorization code with PKCE, sent to
/// the system browser, and refresh tokens. The same issuer and client
/// settings as the web app.
pub struct Oidc {
    config: SyncConfig,
    discovery: Discovery,
}

fn failed(what: &str, error: impl std::fmt::Display) -> String {
    format!("{what}: {error}")
}

pub fn now() -> i64 {
    chrono::Utc::now().timestamp()
}

impl Oidc {
    /// Reads the issuer's `.well-known/openid-configuration`.
    pub fn discover(config: &SyncConfig) -> Result<Self, String> {
        let url = format!(
            "{}/.well-known/openid-configuration",
            config.authority.trim_end_matches('/')
        );
        let discovery: Discovery = ureq::get(&url)
            .call()
            .map_err(|error| failed("Couldn't reach the sign-in service", error))?
            .body_mut()
            .read_json()
            .map_err(|error| failed("The sign-in service answered oddly", error))?;
        Ok(Self {
            config: config.clone(),
            discovery,
        })
    }

    #[cfg(test)]
    pub fn with(config: SyncConfig, discovery: Discovery) -> Self {
        Self { config, discovery }
    }

    pub fn authorize_url(&self, redirect_uri: &str, pkce: &Pkce, state: &str) -> String {
        let mut url = Url::parse(&self.discovery.authorization_endpoint)
            .unwrap_or_else(|_| Url::parse("http://invalid/").expect("a valid url"));
        {
            let mut query = url.query_pairs_mut();
            query
                .append_pair("response_type", "code")
                .append_pair("client_id", &self.config.client_id)
                .append_pair("redirect_uri", redirect_uri)
                .append_pair("scope", SCOPE)
                .append_pair("state", state)
                .append_pair("code_challenge", &pkce.challenge)
                .append_pair("code_challenge_method", "S256");
            if let Some(audience) = self.config.audience.as_deref().filter(|a| !a.is_empty()) {
                query.append_pair("audience", audience);
            }
        }
        url.into()
    }

    fn token_request(
        &self,
        form: &[(&str, &str)],
        previous: Option<&Tokens>,
    ) -> Result<Tokens, String> {
        let response: TokenResponse = ureq::post(&self.discovery.token_endpoint)
            .send_form(form.iter().copied())
            .map_err(|error| failed("The sign-in service refused", error))?
            .body_mut()
            .read_json()
            .map_err(|error| failed("The sign-in service answered oddly", error))?;
        Ok(Tokens {
            access_token: response.access_token,
            refresh_token: response
                .refresh_token
                .or_else(|| previous.and_then(|tokens| tokens.refresh_token.clone())),
            id_token: response
                .id_token
                .or_else(|| previous.and_then(|tokens| tokens.id_token.clone())),
            expires_at: now() + response.expires_in.unwrap_or(300),
        })
    }

    pub fn exchange(&self, code: &str, redirect_uri: &str, pkce: &Pkce) -> Result<Tokens, String> {
        self.token_request(
            &[
                ("grant_type", "authorization_code"),
                ("code", code),
                ("redirect_uri", redirect_uri),
                ("client_id", &self.config.client_id),
                ("code_verifier", &pkce.verifier),
            ],
            None,
        )
    }

    pub fn refresh(&self, tokens: &Tokens) -> Result<Tokens, String> {
        let refresh_token = tokens
            .refresh_token
            .as_deref()
            .ok_or("The sign-in expired. Sign in again.")?;
        self.token_request(
            &[
                ("grant_type", "refresh_token"),
                ("refresh_token", refresh_token),
                ("client_id", &self.config.client_id),
            ],
            Some(tokens),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_authorization_request_carries_pkce_and_the_audience() {
        let oidc = Oidc::with(
            SyncConfig {
                server_url: "http://localhost:8080".into(),
                authority: "http://localhost:8090/default".into(),
                client_id: "time-desktop".into(),
                audience: Some("time-api".into()),
            },
            Discovery {
                authorization_endpoint: "http://localhost:8090/default/authorize".into(),
                token_endpoint: "http://localhost:8090/default/token".into(),
            },
        );
        let pkce = Pkce::new();
        let url =
            Url::parse(&oidc.authorize_url("http://127.0.0.1:5000/callback", &pkce, "s1")).unwrap();
        let query: std::collections::HashMap<_, _> = url.query_pairs().into_owned().collect();
        assert_eq!(query["response_type"], "code");
        assert_eq!(query["client_id"], "time-desktop");
        assert_eq!(query["redirect_uri"], "http://127.0.0.1:5000/callback");
        assert_eq!(query["code_challenge"], pkce.challenge);
        assert_eq!(query["code_challenge_method"], "S256");
        assert_eq!(query["state"], "s1");
        assert_eq!(query["audience"], "time-api");
        assert!(query["scope"].contains("offline_access"));
    }
}
