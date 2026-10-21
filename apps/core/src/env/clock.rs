use chrono::{DateTime, FixedOffset, Local};

pub trait Clock {
    fn now(&self) -> DateTime<FixedOffset>;
}

/// The device's wall clock in its local time zone.
#[derive(Debug, Default, Clone, Copy)]
pub struct SystemClock;

impl Clock for SystemClock {
    fn now(&self) -> DateTime<FixedOffset> {
        Local::now().fixed_offset()
    }
}

/// A clock stopped at one instant, for replaying a mutation or for tests.
#[derive(Debug, Clone, Copy)]
pub struct FixedClock(pub DateTime<FixedOffset>);

impl Clock for FixedClock {
    fn now(&self) -> DateTime<FixedOffset> {
        self.0
    }
}
