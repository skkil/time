use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use serde::Deserialize;

/// The claims this app reads from a JWT: an ID token's profile, or a sync
/// token's scope (`sub`) and expiry. The signature is not checked: both
/// arrive straight from the issuer over TLS (OIDC Core 3.1.3.7).
#[derive(Debug, Default, Clone, PartialEq, Deserialize)]
pub struct Claims {
    pub sub: Option<String>,
    pub name: Option<String>,
    pub email: Option<String>,
    pub exp: Option<i64>,
}

pub fn decode(token: &str) -> Option<Claims> {
    let payload = token.split('.').nth(1)?;
    let bytes = URL_SAFE_NO_PAD.decode(payload.trim_end_matches('=')).ok()?;
    serde_json::from_slice(&bytes).ok()
}

#[cfg(test)]
pub fn encode(claims: &serde_json::Value) -> String {
    let header = URL_SAFE_NO_PAD.encode(br#"{"alg":"none"}"#);
    let body = URL_SAFE_NO_PAD.encode(claims.to_string());
    format!("{header}.{body}.")
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn reads_the_profile_and_expiry() {
        let token =
            encode(&json!({ "sub": "abc", "name": "Ada", "email": "ada@example.com", "exp": 10 }));
        let claims = decode(&token).unwrap();
        assert_eq!(claims.sub.as_deref(), Some("abc"));
        assert_eq!(claims.name.as_deref(), Some("Ada"));
        assert_eq!(claims.email.as_deref(), Some("ada@example.com"));
        assert_eq!(claims.exp, Some(10));
        assert!(decode("not a token").is_none());
    }
}
