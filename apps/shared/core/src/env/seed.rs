use uuid::Uuid;

use crate::types::{Date, Id};

/// The id of a row that has a natural key in an account: the RFC 9562
/// version 5 UUID of `name` (`<table>/<key parts joined by />`) with the
/// account's scope id as namespace. The server derives the same ids, so
/// devices that write the same key offline agree without coordinating.
pub fn seed_id(scope: Uuid, name: &str) -> Id {
    Id::from(Uuid::new_v5(&scope, name.as_bytes()))
}

/// Rows identified by what they are about rather than by a new id. Adding a
/// table here is the one change that gives its rows deterministic ids.
#[derive(Debug, Clone, Copy)]
pub enum NaturalKey<'a> {
    Ritual(&'a str),
    Week(Date),
    Day(Date),
    Setting(&'a str),
    HabitLog(&'a Id, Date),
    ProjectCanvas(&'a Id),
    RecordPhase(&'a Id, &'a Id),
    TaskDependency(&'a Id, &'a Id),
    RunningTimer,
}

impl NaturalKey<'_> {
    /// `<table>/<key parts>`, the name [`seed_id`] hashes.
    pub fn name(&self) -> String {
        match self {
            Self::Ritual(kind) => format!("ritual/{kind}"),
            Self::Week(start) => format!("week/{start}"),
            Self::Day(date) => format!("day/{date}"),
            Self::Setting(key) => format!("setting/{key}"),
            Self::HabitLog(habit, date) => format!("habit_log/{habit}/{date}"),
            Self::ProjectCanvas(project) => format!("project_canvas/{project}"),
            Self::RecordPhase(task, status) => format!("record_phase/{task}/{status}"),
            Self::TaskDependency(task, blocker) => format!("task_dependency/{task}/{blocker}"),
            Self::RunningTimer => "running_timer".to_owned(),
        }
    }

    pub fn id(&self, scope: Uuid) -> Id {
        seed_id(scope, &self.name())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::date;

    const SCOPE: Uuid = Uuid::from_u128(0x0192_f0c1_7a2b_7c3d_8e4f_0123_4567_89ab);

    #[test]
    fn the_same_key_gets_the_same_id_in_one_account_only() {
        let morning = NaturalKey::Ritual("morning");
        assert_eq!(morning.id(SCOPE), morning.id(SCOPE));
        assert_ne!(morning.id(SCOPE), NaturalKey::Ritual("evening").id(SCOPE));
        assert_ne!(morning.id(SCOPE), morning.id(Uuid::from_u128(1)));
    }

    #[test]
    fn match_the_shared_vectors_the_server_checks_too() {
        let file: serde_json::Value =
            serde_json::from_str(include_str!("../../../client/src/types/natural-keys.json"))
                .unwrap();
        let mut kinds = std::collections::BTreeSet::new();
        for vector in file["vectors"].as_array().unwrap() {
            let text = |field: &str| vector[field].as_str().unwrap();
            let scope = Uuid::parse_str(text("scope")).unwrap();
            let parts: Vec<&str> = vector["parts"]
                .as_array()
                .unwrap()
                .iter()
                .map(|part| part.as_str().unwrap())
                .collect();
            let ids: Vec<Id> = parts
                .iter()
                .filter_map(|part| Id::parse(part).ok())
                .collect();
            let key = match text("kind") {
                "setting" => Some(NaturalKey::Setting(parts[0])),
                "project_canvas" => Some(NaturalKey::ProjectCanvas(&ids[0])),
                "week" => Some(NaturalKey::Week(date(parts[0]))),
                "day" => Some(NaturalKey::Day(date(parts[0]))),
                "task_dependency" => Some(NaturalKey::TaskDependency(&ids[0], &ids[1])),
                "record_phase" => Some(NaturalKey::RecordPhase(&ids[0], &ids[1])),
                "running_timer" => Some(NaturalKey::RunningTimer),
                "habit_log" => Some(NaturalKey::HabitLog(&ids[0], date(parts[1]))),
                "ritual" => Some(NaturalKey::Ritual(parts[0])),
                "user_preference" => None,
                other => panic!("unknown natural key kind {other}"),
            };
            if let Some(key) = key {
                assert_eq!(key.name(), text("name"));
                assert_eq!(key.id(scope).as_str(), text("id"), "{}", text("name"));
            }
            assert_eq!(seed_id(scope, text("name")).as_str(), text("id"));
            kinds.insert(text("kind").to_owned());
        }
        assert_eq!(kinds.len(), 10, "every natural key of the decision record");
    }

    #[test]
    fn ids_are_version_5_uuids_of_the_table_and_key() {
        let id = NaturalKey::Week(date("2026-11-02")).id(SCOPE);
        let uuid = Uuid::parse_str(id.as_str()).unwrap();
        assert_eq!(uuid.get_version_num(), 5);
        assert_eq!(uuid, Uuid::new_v5(&SCOPE, b"week/2026-11-02"));
        assert_eq!(NaturalKey::RunningTimer.name(), "running_timer");
    }
}
