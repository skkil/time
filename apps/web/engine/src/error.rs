use time_core::Error;
use wasm_bindgen::JsValue;

use crate::js;

pub type JsResult<T> = Result<T, JsValue>;

/// A core error as the `{ kind, message }` object the app's error handling
/// expects from every backend.
pub fn to_js(error: Error) -> JsValue {
    js::value(&error).unwrap_or_else(|failure| failure)
}

pub fn invalid(message: impl Into<String>) -> JsValue {
    to_js(Error::invalid(message))
}

pub fn database(message: impl Into<String>) -> JsValue {
    to_js(Error::Database(message.into()))
}
