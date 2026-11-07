//! Desktop-only commands behind `Platform.sync`. They are not part of the
//! shared contract: web and mobile sign in their own way.

use std::sync::Arc;

use tauri::State;
use time_core::{Error, Result};

use super::config::SyncConfig;
use super::schedule::Trigger;
use super::service::SyncService;
use super::view::{AccountChoice, SyncIssueView, SyncView};
use crate::db::Db;

type Sync<'a> = State<'a, Arc<SyncService>>;

fn invalid(error: String) -> Error {
    Error::invalid(error)
}

#[tauri::command]
#[specta::specta]
pub async fn sync_status(sync: Sync<'_>) -> Result<SyncView> {
    sync.view().map_err(invalid)
}

#[tauri::command]
#[specta::specta]
pub async fn sync_now(sync: Sync<'_>) -> Result<()> {
    sync.trigger(Trigger::Now);
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn sync_issues(db: State<'_, Db>) -> Result<Vec<SyncIssueView>> {
    let issues = db.engine(|engine| engine.issues())?;
    Ok(issues.into_iter().map(SyncIssueView::from).collect())
}

#[tauri::command]
#[specta::specta]
pub async fn dismiss_sync_issue(db: State<'_, Db>, sync: Sync<'_>, id: i32) -> Result<()> {
    db.engine(|engine| engine.dismiss_issue(i64::from(id)))?;
    sync.emit();
    Ok(())
}

/// Sends a refused change again; it waits to push like a new change.
#[tauri::command]
#[specta::specta]
pub async fn retry_sync_issue(db: State<'_, Db>, sync: Sync<'_>, id: i32) -> Result<()> {
    db.mutate_with(|engine| engine.retry_issue(i64::from(id)))?;
    sync.emit();
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn sign_in(sync: Sync<'_>) -> Result<()> {
    let sync = Arc::clone(&sync);
    tauri::async_runtime::spawn_blocking(move || sync.sign_in())
        .await
        .map_err(|error| Error::invalid(error.to_string()))?
        .map_err(invalid)
}

#[tauri::command]
#[specta::specta]
pub async fn choose_account_data(sync: Sync<'_>, choice: AccountChoice) -> Result<()> {
    sync.choose(choice).map_err(invalid)
}

#[tauri::command]
#[specta::specta]
pub async fn sign_out(sync: Sync<'_>) -> Result<()> {
    sync.sign_out().map_err(invalid)
}

#[tauri::command]
#[specta::specta]
pub async fn get_sync_config(db: State<'_, Db>) -> Result<SyncConfig> {
    db.call(|conn| SyncConfig::load(conn))
}

#[tauri::command]
#[specta::specta]
pub async fn set_sync_config(db: State<'_, Db>, config: SyncConfig) -> Result<()> {
    db.call(|conn| config.save(conn))
}
