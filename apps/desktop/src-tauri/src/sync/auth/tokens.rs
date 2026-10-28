use serde::{Deserialize, Serialize};

use super::claims::{self, Claims};

const KEYRING_SERVICE: &str = "com.skkil.time";
const KEYRING_USER: &str = "sync-tokens";
/// Refresh this long before the access token runs out.
const REFRESH_MARGIN_SECONDS: i64 = 60;

/// What the identity provider issued at sign-in or the last refresh.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Tokens {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub id_token: Option<String>,
    /// Unix seconds.
    pub expires_at: i64,
}

impl Tokens {
    pub fn needs_refresh(&self, now: i64) -> bool {
        now + REFRESH_MARGIN_SECONDS >= self.expires_at
    }

    /// The signed-in person, from the ID token.
    pub fn profile(&self) -> Claims {
        self.id_token
            .as_deref()
            .and_then(claims::decode)
            .unwrap_or_default()
    }
}

/// Where tokens are kept between launches.
pub trait TokenStore: Send + Sync {
    fn load(&self) -> Option<Tokens>;
    fn save(&self, tokens: &Tokens) -> Result<(), String>;
    fn clear(&self) -> Result<(), String>;
}

/// The OS keychain: Keychain on macOS, Credential Manager on Windows, the
/// Secret Service on Linux.
pub struct KeyringStore;

impl KeyringStore {
    fn entry() -> Result<keyring::Entry, String> {
        keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER).map_err(|error| error.to_string())
    }
}

impl TokenStore for KeyringStore {
    fn load(&self) -> Option<Tokens> {
        let secret = Self::entry().ok()?.get_password().ok()?;
        serde_json::from_str(&secret).ok()
    }

    fn save(&self, tokens: &Tokens) -> Result<(), String> {
        let secret = serde_json::to_string(tokens).map_err(|error| error.to_string())?;
        Self::entry()?
            .set_password(&secret)
            .map_err(|error| format!("Couldn't keep the sign-in in the keychain: {error}"))
    }

    fn clear(&self) -> Result<(), String> {
        match Self::entry()?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(error.to_string()),
        }
    }
}

/// Tokens kept in memory only, for tests.
#[cfg(test)]
#[derive(Default)]
pub struct MemoryStore(std::sync::Mutex<Option<Tokens>>);

#[cfg(test)]
impl TokenStore for MemoryStore {
    fn load(&self) -> Option<Tokens> {
        self.0.lock().ok()?.clone()
    }

    fn save(&self, tokens: &Tokens) -> Result<(), String> {
        *self.0.lock().map_err(|error| error.to_string())? = Some(tokens.clone());
        Ok(())
    }

    fn clear(&self) -> Result<(), String> {
        *self.0.lock().map_err(|error| error.to_string())? = None;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    fn tokens(expires_at: i64) -> Tokens {
        Tokens {
            access_token: "access".into(),
            refresh_token: Some("refresh".into()),
            id_token: Some(claims::encode(
                &json!({ "name": "Ada", "email": "ada@example.com" }),
            )),
            expires_at,
        }
    }

    #[test]
    fn refreshes_a_minute_before_expiry() {
        assert!(!tokens(1_000).needs_refresh(900));
        assert!(tokens(1_000).needs_refresh(940));
        assert!(tokens(1_000).needs_refresh(2_000));
    }

    #[test]
    fn the_profile_comes_from_the_id_token() {
        let profile = tokens(0).profile();
        assert_eq!(profile.name.as_deref(), Some("Ada"));
        assert_eq!(profile.email.as_deref(), Some("ada@example.com"));
    }

    #[test]
    fn a_store_keeps_and_forgets_tokens() {
        let store = MemoryStore::default();
        assert!(store.load().is_none());
        store.save(&tokens(5)).unwrap();
        assert_eq!(store.load(), Some(tokens(5)));
        store.clear().unwrap();
        assert!(store.load().is_none());
    }

    #[test]
    fn the_keyring_store_round_trips_through_a_mock_keychain() {
        keyring::set_default_credential_builder(keyring::mock::default_credential_builder());
        let store = KeyringStore;
        store.clear().unwrap();
        assert!(store.save(&tokens(7)).is_ok());
        store.clear().unwrap();
        assert!(store.load().is_none());
    }
}
