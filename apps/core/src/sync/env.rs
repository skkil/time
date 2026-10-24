use std::cell::RefCell;

use chrono::{DateTime, FixedOffset, Local, TimeZone, Utc};
use store_core::MutationContext;
use store_core::uuid::Uuid;

use crate::env::MutationEnv;
use crate::types::Id;

/// A mutation's environment inside store: "now" is the moment the user
/// acted (the mutation's HLC wall time) in this device's time zone, and new
/// ids are derived from the client and mutation, so the server and every
/// replay make the same ones. Rows with a natural key take the account's
/// derived id for it.
pub struct StoreEnv<'a> {
    ctx: RefCell<&'a mut MutationContext>,
    scope: Option<Uuid>,
}

impl<'a> StoreEnv<'a> {
    pub fn new(ctx: &'a mut MutationContext, scope: Option<Uuid>) -> Self {
        Self {
            ctx: RefCell::new(ctx),
            scope,
        }
    }
}

impl MutationEnv for StoreEnv<'_> {
    fn now(&self) -> DateTime<FixedOffset> {
        let millis = self.ctx.borrow().now();
        let utc = Utc
            .timestamp_millis_opt(millis)
            .single()
            .unwrap_or_default();
        utc.with_timezone(&Local).fixed_offset()
    }

    fn next_id(&self) -> Id {
        Id::from(self.ctx.borrow_mut().next_id())
    }

    fn scope(&self) -> Option<Uuid> {
        self.scope
    }
}

#[cfg(test)]
mod tests {
    use store_core::{Hlc, derive_id, uuid::Uuid};

    use super::*;

    #[test]
    fn time_and_ids_come_from_the_mutation() {
        let client = Uuid::from_u128(7);
        let mut ctx = MutationContext::new(client, 3, Hlc::new(1_793_000_000_000, 2));
        let env = StoreEnv::new(&mut ctx, None);
        assert_eq!(env.now().timestamp_millis(), 1_793_000_000_000);
        assert_eq!(env.next_id(), Id::from(derive_id(client, 3, 0)));
        assert_eq!(env.next_id(), Id::from(derive_id(client, 3, 1)));
    }
}
