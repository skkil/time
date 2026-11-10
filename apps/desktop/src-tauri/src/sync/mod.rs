//! Desktop sync through skkil store: OIDC sign-in, a background worker
//! that pushes and pulls with `skkil-store-http` on a [`schedule`], the
//! poke stream, and the commands behind `Platform.sync`.

pub mod api;
pub mod auth;
pub mod calendars;
pub mod commands;
pub mod config;
mod credentials;
mod cycle;
pub mod schedule;
pub mod service;
pub mod session;
pub mod view;

pub use schedule::Trigger;
pub use service::SyncService;
