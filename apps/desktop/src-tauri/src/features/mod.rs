pub mod blocks;
pub mod habits;
pub mod labels;
pub mod projects;
pub mod review;
pub mod sections;
pub mod tasks;
pub mod time_entries;

use crate::error::{Error, Result};

pub(crate) fn required_text(value: &str, what: &str, max: usize) -> Result<String> {
    let value = value.trim();
    if value.is_empty() {
        return Err(Error::invalid(format!("{what} can't be empty.")));
    }
    if value.chars().count() > max {
        return Err(Error::invalid(format!(
            "{what} is longer than {max} characters."
        )));
    }
    Ok(value.to_owned())
}

pub(crate) fn optional_text(value: &str, what: &str, max: usize) -> Result<String> {
    let value = value.trim();
    if value.chars().count() > max {
        return Err(Error::invalid(format!(
            "{what} is longer than {max} characters."
        )));
    }
    Ok(value.to_owned())
}

pub(crate) fn ensure_changed(rows: usize, what: &str) -> Result<()> {
    if rows == 0 {
        return Err(Error::not_found(what));
    }
    Ok(())
}
