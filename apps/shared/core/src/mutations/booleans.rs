use serde::de::{
    self, DeserializeOwned, DeserializeSeed, Deserializer, EnumAccess, MapAccess, SeqAccess,
    Unexpected, VariantAccess, Visitor,
};
use serde_json::{Error, Value, map};

/// Reads mutation arguments as `serde_json::from_value` does, except that a
/// boolean may also be the `1`/`0` a SQLite device may send, at any depth.
/// Any other number is still refused. The server reads arguments the same
/// way (`SqliteBooleans.kt`).
pub fn from_value<T: DeserializeOwned>(value: Value) -> Result<T, Error> {
    T::deserialize(SqliteBooleans(value))
}

struct SqliteBooleans(Value);

macro_rules! delegate {
    ($($method:ident)*) => {
        $(fn $method<V: Visitor<'de>>(self, visitor: V) -> Result<V::Value, Error> {
            self.0.$method(visitor)
        })*
    };
}

macro_rules! wrap {
    ($($method:ident)*) => {
        $(fn $method<V: Visitor<'de>>(self, visitor: V) -> Result<V::Value, Error> {
            self.deserialize_any(visitor)
        })*
    };
}

impl<'de> Deserializer<'de> for SqliteBooleans {
    type Error = Error;

    fn deserialize_any<V: Visitor<'de>>(self, visitor: V) -> Result<V::Value, Error> {
        match self.0 {
            Value::Array(items) => visitor.visit_seq(Items(items.into_iter())),
            Value::Object(fields) => visitor.visit_map(Fields {
                fields: fields.into_iter(),
                value: None,
            }),
            other => other.deserialize_any(visitor),
        }
    }

    fn deserialize_bool<V: Visitor<'de>>(self, visitor: V) -> Result<V::Value, Error> {
        match &self.0 {
            Value::Number(number) if number.as_u64() == Some(1) => visitor.visit_bool(true),
            Value::Number(number) if number.as_u64() == Some(0) => visitor.visit_bool(false),
            _ => self.0.deserialize_bool(visitor),
        }
    }

    fn deserialize_option<V: Visitor<'de>>(self, visitor: V) -> Result<V::Value, Error> {
        match self.0 {
            Value::Null => visitor.visit_none(),
            other => visitor.visit_some(SqliteBooleans(other)),
        }
    }

    fn deserialize_newtype_struct<V: Visitor<'de>>(
        self,
        _name: &'static str,
        visitor: V,
    ) -> Result<V::Value, Error> {
        visitor.visit_newtype_struct(self)
    }

    fn deserialize_enum<V: Visitor<'de>>(
        self,
        name: &'static str,
        variants: &'static [&'static str],
        visitor: V,
    ) -> Result<V::Value, Error> {
        match self.0 {
            Value::String(variant) => visitor.visit_enum(Variant {
                name: variant,
                content: None,
            }),
            Value::Object(fields) if fields.len() == 1 => {
                let (variant, content) = fields.into_iter().next().expect("one field");
                visitor.visit_enum(Variant {
                    name: variant,
                    content: Some(content),
                })
            }
            other => other.deserialize_enum(name, variants, visitor),
        }
    }

    fn deserialize_unit_struct<V: Visitor<'de>>(
        self,
        name: &'static str,
        visitor: V,
    ) -> Result<V::Value, Error> {
        self.0.deserialize_unit_struct(name, visitor)
    }

    fn deserialize_tuple<V: Visitor<'de>>(
        self,
        _len: usize,
        visitor: V,
    ) -> Result<V::Value, Error> {
        self.deserialize_any(visitor)
    }

    fn deserialize_tuple_struct<V: Visitor<'de>>(
        self,
        _name: &'static str,
        _len: usize,
        visitor: V,
    ) -> Result<V::Value, Error> {
        self.deserialize_any(visitor)
    }

    fn deserialize_struct<V: Visitor<'de>>(
        self,
        _name: &'static str,
        _fields: &'static [&'static str],
        visitor: V,
    ) -> Result<V::Value, Error> {
        self.deserialize_any(visitor)
    }

    delegate! {
        deserialize_i8 deserialize_i16 deserialize_i32 deserialize_i64 deserialize_i128
        deserialize_u8 deserialize_u16 deserialize_u32 deserialize_u64 deserialize_u128
        deserialize_f32 deserialize_f64 deserialize_char deserialize_str deserialize_string
        deserialize_bytes deserialize_byte_buf deserialize_unit deserialize_identifier
        deserialize_ignored_any
    }

    wrap! { deserialize_seq deserialize_map }
}

struct Items(std::vec::IntoIter<Value>);

impl<'de> SeqAccess<'de> for Items {
    type Error = Error;

    fn next_element_seed<S: DeserializeSeed<'de>>(
        &mut self,
        seed: S,
    ) -> Result<Option<S::Value>, Error> {
        self.0
            .next()
            .map(|item| seed.deserialize(SqliteBooleans(item)))
            .transpose()
    }

    fn size_hint(&self) -> Option<usize> {
        Some(self.0.len())
    }
}

struct Fields {
    fields: map::IntoIter,
    value: Option<Value>,
}

impl<'de> MapAccess<'de> for Fields {
    type Error = Error;

    fn next_key_seed<S: DeserializeSeed<'de>>(
        &mut self,
        seed: S,
    ) -> Result<Option<S::Value>, Error> {
        let Some((key, value)) = self.fields.next() else {
            return Ok(None);
        };
        self.value = Some(value);
        seed.deserialize(Value::String(key)).map(Some)
    }

    fn next_value_seed<S: DeserializeSeed<'de>>(&mut self, seed: S) -> Result<S::Value, Error> {
        let value = self
            .value
            .take()
            .ok_or_else(|| de::Error::custom("a map value was read before its key"))?;
        seed.deserialize(SqliteBooleans(value))
    }

    fn size_hint(&self) -> Option<usize> {
        Some(self.fields.len())
    }
}

struct Variant {
    name: String,
    content: Option<Value>,
}

impl<'de> EnumAccess<'de> for Variant {
    type Error = Error;
    type Variant = Content;

    fn variant_seed<S: DeserializeSeed<'de>>(self, seed: S) -> Result<(S::Value, Content), Error> {
        let variant = seed.deserialize(Value::String(self.name))?;
        Ok((variant, Content(self.content)))
    }
}

struct Content(Option<Value>);

impl Content {
    fn value(self, expected: &str) -> Result<Value, Error> {
        self.0
            .ok_or_else(|| de::Error::invalid_type(Unexpected::UnitVariant, &expected))
    }
}

impl<'de> VariantAccess<'de> for Content {
    type Error = Error;

    fn unit_variant(self) -> Result<(), Error> {
        match self.0 {
            None | Some(Value::Null) => Ok(()),
            Some(_) => Err(de::Error::invalid_type(
                Unexpected::NewtypeVariant,
                &"unit variant",
            )),
        }
    }

    fn newtype_variant_seed<S: DeserializeSeed<'de>>(self, seed: S) -> Result<S::Value, Error> {
        seed.deserialize(SqliteBooleans(self.value("newtype variant")?))
    }

    fn tuple_variant<V: Visitor<'de>>(self, _len: usize, visitor: V) -> Result<V::Value, Error> {
        SqliteBooleans(self.value("tuple variant")?).deserialize_any(visitor)
    }

    fn struct_variant<V: Visitor<'de>>(
        self,
        _fields: &'static [&'static str],
        visitor: V,
    ) -> Result<V::Value, Error> {
        SqliteBooleans(self.value("struct variant")?).deserialize_any(visitor)
    }
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use serde::Deserialize;
    use serde_json::json;

    use super::*;

    #[derive(Debug, PartialEq, Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Settings {
        in_order: bool,
        archived: Option<bool>,
        flags: Vec<bool>,
        by_day: BTreeMap<String, bool>,
        mode: Mode,
        count: i32,
        label: String,
    }

    #[derive(Debug, PartialEq, Deserialize)]
    #[serde(rename_all = "camelCase")]
    enum Mode {
        Off,
        On { strict: bool },
    }

    fn read(value: Value) -> Result<Settings, Error> {
        from_value(value)
    }

    #[test]
    fn reads_one_and_zero_as_booleans_at_any_depth() {
        let read = read(json!({
            "inOrder": 1, "archived": 0, "flags": [1, false, 0],
            "byDay": {"mon": 1, "tue": true}, "mode": {"on": {"strict": 0}},
            "count": 1, "label": "1"
        }))
        .unwrap();
        assert_eq!(
            read,
            Settings {
                in_order: true,
                archived: Some(false),
                flags: vec![true, false, false],
                by_day: BTreeMap::from([("mon".into(), true), ("tue".into(), true)]),
                mode: Mode::On { strict: false },
                count: 1,
                label: "1".into(),
            }
        );
    }

    #[test]
    fn reads_everything_else_as_serde_json_does() {
        let value = json!({
            "inOrder": true, "archived": null, "flags": [], "byDay": {},
            "mode": "off", "count": -3, "label": ""
        });
        assert_eq!(
            read(value.clone()).unwrap(),
            serde_json::from_value::<Settings>(value).unwrap()
        );
    }

    #[test]
    fn refuses_other_numbers_and_strings_as_booleans() {
        let base = json!({
            "inOrder": 1, "archived": null, "flags": [], "byDay": {},
            "mode": "off", "count": 0, "label": ""
        });
        for wrong in [json!(2), json!(-1), json!(1.0), json!("1"), json!("true")] {
            let mut value = base.clone();
            value["inOrder"] = wrong.clone();
            assert!(read(value).is_err(), "{wrong} read as a boolean");
        }
        assert!(read(json!({"inOrder": 1})).is_err());
    }
}
