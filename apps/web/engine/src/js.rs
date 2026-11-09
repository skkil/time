use serde::Serialize;
use wasm_bindgen::JsValue;

/// `value` as a plain JS object: maps become objects and 64-bit integers
/// numbers, as `JSON.parse` would give them.
pub fn value<T: Serialize + ?Sized>(value: &T) -> Result<JsValue, JsValue> {
    value
        .serialize(&serde_wasm_bindgen::Serializer::json_compatible())
        .map_err(JsValue::from)
}
