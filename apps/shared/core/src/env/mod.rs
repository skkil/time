mod clock;
mod ids;
mod seed;

use chrono::{DateTime, FixedOffset};
use uuid::Uuid;

pub use clock::{Clock, FixedClock, SystemClock};
pub use ids::{IdSource, RandomIds, SequentialIds};
pub use seed::{NaturalKey, seed_id};

use crate::types::{Date, Id, Timestamp};

/// Where a write takes its clock and its new ids from. Every write path reads
/// "now" and "today" through it, so a replayed mutation sees the moment the
/// user acted instead of the moment it is applied.
pub trait MutationEnv {
    fn now(&self) -> DateTime<FixedOffset>;
    fn next_id(&self) -> Id;

    /// The account the write belongs to; `None` on a device that never
    /// signed in.
    fn scope(&self) -> Option<Uuid> {
        None
    }

    /// The id of the row with this natural key: derived from the account
    /// when there is one, so every device and the server agree, else new.
    fn keyed_id(&self, key: NaturalKey) -> Id {
        match self.scope() {
            Some(scope) => key.id(scope),
            None => self.next_id(),
        }
    }

    fn timestamp(&self) -> Timestamp {
        Timestamp(self.now().timestamp())
    }

    fn today(&self) -> Date {
        Date(self.now().date_naive())
    }
}

#[derive(Debug, Default)]
pub struct Env<C = SystemClock, I = RandomIds> {
    pub clock: C,
    pub ids: I,
}

/// The device's own clock with random UUIDv7 ids.
pub type LocalEnv = Env<SystemClock, RandomIds>;

impl<C: Clock, I: IdSource> MutationEnv for Env<C, I> {
    fn now(&self) -> DateTime<FixedOffset> {
        self.clock.now()
    }

    fn next_id(&self) -> Id {
        self.ids.next_id()
    }
}
