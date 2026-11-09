use serde::Serialize;
use serde_json::Value;

/// A change of this device the server refused, for the "Couldn't apply"
/// list: which command, what it was about, and why.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Issue {
    pub id: i64,
    pub name: String,
    pub subject: Option<String>,
    pub reason: String,
    pub created_at: i64,
}

const SUBJECT_PATHS: [&[&str]; 5] = [
    &["input", "title"],
    &["title"],
    &["input", "name"],
    &["name"],
    &["label"],
];

/// The title or name a mutation's arguments carry, if any.
fn subject(args: &Value) -> Option<String> {
    SUBJECT_PATHS.iter().find_map(|path| {
        path.iter()
            .try_fold(args, |value, key| value.get(key))
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|text| !text.is_empty())
            .map(str::to_owned)
    })
}

impl From<store_core::SyncIssue> for Issue {
    fn from(issue: store_core::SyncIssue) -> Self {
        Self {
            id: issue.id,
            subject: subject(&issue.args),
            name: issue.name,
            reason: issue.reason,
            created_at: issue.created_at,
        }
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::subject;

    #[test]
    fn finds_what_a_change_was_about() {
        assert_eq!(
            subject(&json!({"input": {"title": " Buy milk "}})),
            Some("Buy milk".into())
        );
        assert_eq!(subject(&json!({"name": "Acme"})), Some("Acme".into()));
        assert_eq!(subject(&json!({"id": "x"})), None);
    }
}
