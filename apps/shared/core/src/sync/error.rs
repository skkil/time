use crate::error::Error;

use super::mutator::into_error;

impl From<store_core::Error> for Error {
    fn from(error: store_core::Error) -> Self {
        match error {
            store_core::Error::Mutation(error) => into_error(error),
            store_core::Error::Sqlite(error) => error.into(),
            store_core::Error::ScopeMismatch { .. } => {
                Self::invalid("This device belongs to another account. Sign out first.")
            }
            other => Self::Database(other.to_string()),
        }
    }
}
