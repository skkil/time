use serde_json::json;
use time_core::Result;
use time_core::habits::{self, SyncReport, TrackerState};
use time_core::sync::Engine;
use time_core::types::Date;

/// `syncHabits` in a browser: habits that track a project's time are
/// measured from tracked time; websites and apps can't be read here.
pub fn sync_project_habits(engine: &mut Engine) -> Result<SyncReport> {
    let today = Date::today();
    let measured = {
        let conn = engine.connection();
        let tracked = habits::tracked(conn)?;
        habits::project_measurements(conn, &tracked, today)?
    };
    if !measured.is_empty() {
        engine.mutate(
            "recordHabitMeasurements",
            &json!({ "measurements": measured }),
        )?;
    }
    Ok(SyncReport {
        activitywatch: TrackerState::NotNeeded,
        has_web_data: false,
        has_window_data: false,
        message: None,
    })
}
