use std::cell::Cell;

use uuid::{Builder, Uuid};

use crate::types::Id;

pub trait IdSource {
    fn next_id(&self) -> Id;
}

/// Random UUIDv7 ids, ordered by creation within the process.
#[derive(Debug, Default, Clone, Copy)]
pub struct RandomIds;

impl IdSource for RandomIds {
    fn next_id(&self) -> Id {
        Id::from(Uuid::now_v7())
    }
}

/// Deterministic UUIDv7-shaped ids counting up from a start time, so the same
/// mutations give the same ids.
#[derive(Debug)]
pub struct SequentialIds {
    start_millis: u64,
    issued: Cell<u64>,
}

impl SequentialIds {
    pub fn starting_at(start_millis: u64) -> Self {
        Self {
            start_millis,
            issued: Cell::new(0),
        }
    }
}

impl IdSource for SequentialIds {
    fn next_id(&self) -> Id {
        let index = self.issued.get();
        self.issued.set(index + 1);
        let mut tail = [0u8; 10];
        tail[2..].copy_from_slice(&index.to_be_bytes());
        Id::from(Builder::from_unix_timestamp_millis(self.start_millis + index, &tail).into_uuid())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn random_ids_sort_by_creation() {
        let ids: Vec<Id> = (0..200).map(|_| RandomIds.next_id()).collect();
        let mut sorted = ids.clone();
        sorted.sort();
        assert_eq!(ids, sorted);
    }

    #[test]
    fn sequential_ids_repeat_and_parse() {
        let first = SequentialIds::starting_at(1_700_000_000_000);
        let second = SequentialIds::starting_at(1_700_000_000_000);
        let a: Vec<Id> = (0..3).map(|_| first.next_id()).collect();
        let b: Vec<Id> = (0..3).map(|_| second.next_id()).collect();
        assert_eq!(a, b);
        assert!(a[0] < a[1] && a[1] < a[2]);
        assert_eq!(Id::parse(a[2].as_str()).unwrap(), a[2]);
    }
}
