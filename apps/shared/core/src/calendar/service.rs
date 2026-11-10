use rusqlite::{Connection, params};

use super::model::CalendarSource;
use super::queries::get_source;
use crate::error::{Error, Result};
use crate::types::Id;

/// `setCalendarSourceVisible`: shows or hides one calendar's events on
/// every device of the account.
pub fn set_visible(conn: &Connection, id: &Id, visible: bool) -> Result<CalendarSource> {
    let changed = conn.execute(
        "UPDATE calendar_source SET visible = ?2 WHERE id = ?1",
        params![id, visible],
    )?;
    if changed == 0 {
        return Err(Error::not_found("Calendar"));
    }
    get_source(conn, id)
}
