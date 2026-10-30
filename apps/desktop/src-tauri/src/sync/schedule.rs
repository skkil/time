use std::time::{Duration, Instant};

/// After a local change, wait this long so a burst syncs as one cycle.
pub const DEBOUNCE: Duration = Duration::from_millis(1_500);
/// Sync at least this often while nothing else asks.
pub const POLL: Duration = Duration::from_secs(60);
const BACKOFF_BASE: Duration = Duration::from_secs(1);
const BACKOFF_CAP: Duration = Duration::from_secs(60);

/// Why a sync was asked for.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Trigger {
    /// The app started or the poke stream reconnected.
    Start,
    /// A local change was written.
    Write,
    /// The window came to the front.
    Focus,
    /// The store service said a newer version exists.
    Poke,
    /// The user pressed Sync now.
    Now,
}

/// When the next sync cycle runs: a pure clock-driven plan, so the worker
/// thread only waits for it.
#[derive(Debug)]
pub struct Schedule {
    due: Instant,
    failures: u32,
    retry_at: Option<Instant>,
}

impl Schedule {
    /// A schedule whose first cycle is due at once.
    pub fn new(now: Instant) -> Self {
        Self {
            due: now,
            failures: 0,
            retry_at: None,
        }
    }

    pub fn on(&mut self, trigger: Trigger, now: Instant) {
        let wanted = match trigger {
            Trigger::Write => now + DEBOUNCE,
            Trigger::Now => {
                self.retry_at = None;
                now
            }
            Trigger::Start | Trigger::Focus | Trigger::Poke => now,
        };
        let wanted = self.retry_at.map_or(wanted, |retry| wanted.max(retry));
        self.due = self.due.min(wanted);
    }

    pub fn is_due(&self, now: Instant) -> bool {
        now >= self.due
    }

    /// How long the worker may sleep before the next cycle.
    pub fn wait(&self, now: Instant) -> Duration {
        self.due.saturating_duration_since(now)
    }

    pub fn succeeded(&mut self, now: Instant) {
        self.failures = 0;
        self.retry_at = None;
        self.due = now + POLL;
    }

    /// Backs off exponentially (1 s doubling up to a minute) until the
    /// next success; only Sync now cuts the wait short.
    pub fn failed(&mut self, now: Instant) {
        self.failures += 1;
        let delay = BACKOFF_BASE
            .saturating_mul(1 << (self.failures - 1).min(6))
            .min(BACKOFF_CAP);
        self.retry_at = Some(now + delay);
        self.due = now + delay;
    }

    #[cfg(test)]
    pub fn failures(&self) -> u32 {
        self.failures
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn starts_at_once_then_polls_every_minute() {
        let t0 = Instant::now();
        let mut schedule = Schedule::new(t0);
        assert!(schedule.is_due(t0));
        schedule.succeeded(t0);
        assert!(!schedule.is_due(t0 + Duration::from_secs(59)));
        assert!(schedule.is_due(t0 + POLL));
    }

    #[test]
    fn a_burst_of_writes_syncs_once_shortly_after_the_first() {
        let t0 = Instant::now();
        let mut schedule = Schedule::new(t0);
        schedule.succeeded(t0);
        schedule.on(Trigger::Write, t0);
        assert_eq!(schedule.wait(t0), DEBOUNCE);
        for step in 1..10 {
            schedule.on(Trigger::Write, t0 + Duration::from_millis(step * 100));
        }
        assert!(schedule.is_due(t0 + DEBOUNCE));
    }

    #[test]
    fn focus_and_pokes_sync_right_away() {
        let t0 = Instant::now();
        let mut schedule = Schedule::new(t0);
        schedule.succeeded(t0);
        schedule.on(Trigger::Focus, t0 + Duration::from_secs(3));
        assert!(schedule.is_due(t0 + Duration::from_secs(3)));
        schedule.succeeded(t0);
        schedule.on(Trigger::Poke, t0);
        assert!(schedule.is_due(t0));
    }

    #[test]
    fn failures_back_off_and_sync_now_skips_the_wait() {
        let t0 = Instant::now();
        let mut schedule = Schedule::new(t0);
        schedule.failed(t0);
        assert_eq!(schedule.wait(t0), Duration::from_secs(1));
        schedule.failed(t0);
        schedule.failed(t0);
        assert_eq!(schedule.wait(t0), Duration::from_secs(4));
        schedule.on(Trigger::Focus, t0);
        assert!(!schedule.is_due(t0), "focus waits for the backoff");
        for _ in 0..10 {
            schedule.failed(t0);
        }
        assert_eq!(schedule.wait(t0), BACKOFF_CAP);
        schedule.on(Trigger::Now, t0);
        assert!(schedule.is_due(t0));
        schedule.succeeded(t0);
        assert_eq!(schedule.failures(), 0);
    }
}
