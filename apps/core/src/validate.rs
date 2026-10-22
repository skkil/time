use crate::error::{Error, Result};

pub(crate) fn required_text(value: &str, what: &str, max: usize) -> Result<String> {
    let value = value.trim();
    if value.is_empty() {
        return Err(Error::invalid(format!("{what} can't be empty.")));
    }
    optional_text(value, what, max)
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
