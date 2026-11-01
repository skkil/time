/// The desktop `Error` shape: a kind and a message. The TypeScript side
/// turns it into `{ kind, message }` so the shared UI handles it as it
/// handles desktop and server errors.
#[derive(Debug, PartialEq, Eq, thiserror::Error, uniffi::Error)]
pub enum CoreError {
    #[error("{message}")]
    Database { message: String },
    #[error("{message}")]
    Invalid { message: String },
    #[error("{message}")]
    NotFound { message: String },
}

impl CoreError {
    pub(crate) fn stopped() -> Self {
        Self::Database {
            message: "The local database stopped.".into(),
        }
    }
}

impl From<time_core::Error> for CoreError {
    fn from(error: time_core::Error) -> Self {
        match error {
            time_core::Error::Database(message) => Self::Database { message },
            time_core::Error::Invalid(message) => Self::Invalid { message },
            time_core::Error::NotFound(message) => Self::NotFound { message },
        }
    }
}

pub type Result<T> = std::result::Result<T, CoreError>;
