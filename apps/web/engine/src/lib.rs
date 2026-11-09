//! skkil time's engine for the browser: [`time_core::sync::Engine`] behind
//! wasm-bindgen, over SQLite kept on the Origin Private File System by the
//! sync-access-handle pool VFS. Run it in a dedicated Web Worker (OPFS sync
//! access handles exist only there) and let one tab own the database.
//!
//! Every call returns plain JS values; every failure rejects with an object
//! shaped like the app's `Error` (`{ kind, message }`).

mod backup;
mod error;
mod habits;
mod handle;
mod js;
#[cfg(target_arch = "wasm32")]
mod storage;

pub use handle::TimeCore;
