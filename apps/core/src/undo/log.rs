use std::collections::VecDeque;
use std::sync::Mutex;

use super::snapshot::TaskSnapshot;
use crate::env::{IdSource, RandomIds};
use crate::types::Id;

pub const KEPT_SNAPSHOTS: usize = 50;

/// The device's recent task snapshots, kept in memory and handed out by id.
#[derive(Default)]
pub struct UndoLog(Mutex<VecDeque<(Id, TaskSnapshot)>>);

impl UndoLog {
    fn with<T>(&self, run: impl FnOnce(&mut VecDeque<(Id, TaskSnapshot)>) -> T) -> T {
        let mut snapshots = self
            .0
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        run(&mut snapshots)
    }

    pub fn clear(&self) {
        self.with(VecDeque::clear);
    }

    pub fn keep(&self, snapshot: TaskSnapshot) -> Id {
        let id = RandomIds.next_id();
        self.with(|snapshots| {
            snapshots.push_back((id.clone(), snapshot));
            if snapshots.len() > KEPT_SNAPSHOTS {
                snapshots.pop_front();
            }
        });
        id
    }

    pub fn take(&self, id: &Id) -> Option<TaskSnapshot> {
        self.with(|snapshots| {
            let at = snapshots.iter().position(|(kept, _)| kept == id)?;
            snapshots.remove(at).map(|(_, snapshot)| snapshot)
        })
    }
}
