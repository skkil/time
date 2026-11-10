use tauri::State;
use time_core::Result;
use time_core::glance::{self, Glance};
use time_core::types::{Date, Timestamp};

use crate::db::Db;

#[tauri::command]
#[specta::specta]
pub async fn today_glance(db: State<'_, Db>) -> Result<Glance> {
    db.call(|conn| glance::today_glance(conn, Timestamp::now(), Date::today()))
}
