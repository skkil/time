use serde_json::Value;
use store_core::rusqlite::Transaction;
use store_core::uuid::Uuid;
use store_core::{MutationContext, MutationError, Mutator};

use super::env::StoreEnv;
use crate::error::Error;
use crate::mutations;

/// time's mutation registry as store's [`Mutator`] for one account: the
/// same rules the server applies, with time and ids from the mutation.
#[derive(Debug, Default, Clone, Copy)]
pub struct TimeMutator {
    pub scope: Option<Uuid>,
}

impl TimeMutator {
    pub fn for_scope(scope: Option<Uuid>) -> Self {
        Self { scope }
    }
}

impl Mutator for TimeMutator {
    fn apply(
        &self,
        tx: &Transaction<'_>,
        ctx: &mut MutationContext,
        name: &str,
        args: &Value,
    ) -> Result<Value, MutationError> {
        if !mutations::is_mutation(name) {
            return Err(MutationError::Unknown(name.to_owned()));
        }
        let env = StoreEnv::new(ctx, self.scope);
        mutations::apply(tx, &env, name, args).map_err(|error| match error {
            Error::Invalid(reason) => MutationError::Rejected(reason),
            other => MutationError::Other(Box::new(other)),
        })
    }
}

/// The app's error for a failed mutation, keeping its kind.
pub fn into_error(error: MutationError) -> Error {
    match error {
        MutationError::Rejected(reason) => Error::Invalid(reason),
        MutationError::Unknown(name) => Error::invalid(format!("{name} isn't a mutation.")),
        MutationError::InvalidArgs(reason) => Error::Invalid(reason),
        MutationError::Sqlite(error) => error.into(),
        MutationError::Json(error) => Error::Database(error.to_string()),
        MutationError::Other(error) => match error.downcast::<Error>() {
            Ok(error) => *error,
            Err(other) => Error::Database(other.to_string()),
        },
    }
}
