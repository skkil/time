//! Signing in: OpenID Connect with PKCE in the system browser, a loopback
//! redirect, and tokens kept in the OS keychain.

pub mod claims;
pub mod loopback;
pub mod oidc;
pub mod pkce;
pub mod tokens;
