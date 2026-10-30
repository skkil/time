use std::collections::BTreeSet;

use store_http::{Credentials, HttpTransport};

use crate::db::Db;

const PUSH_BATCH: u32 = 100;
const PULL_LIMIT: u32 = 500;
const MAX_ROUNDS: usize = 8;

/// Why a cycle stopped early.
#[derive(Debug)]
pub enum CycleError {
    /// Push or pull refused the tokens.
    Unauthorized(String),
    /// Anything else; the next cycle retries.
    Failed(String),
}

impl From<store_http::Error> for CycleError {
    fn from(error: store_http::Error) -> Self {
        match &error {
            store_http::Error::Rpc { code, .. } if code == "unauthenticated" => {
                Self::Unauthorized(error.to_string())
            }
            _ => Self::Failed(error.to_string()),
        }
    }
}

impl From<time_core::Error> for CycleError {
    fn from(error: time_core::Error) -> Self {
        Self::Failed(error.to_string())
    }
}

/// What one cycle did.
#[derive(Debug, Default)]
pub struct CycleReport {
    pub changed_tables: BTreeSet<String>,
    pub new_issues: usize,
}

/// Pushes every pending mutation and pulls until caught up, repeating while
/// a pull asks for answered mutations to be pushed again. The database lock
/// is held only to build requests and apply responses, never during I/O.
pub fn run<C: Credentials>(
    db: &Db,
    transport: &HttpTransport<C>,
) -> Result<CycleReport, CycleError> {
    let mut report = CycleReport::default();
    for _ in 0..MAX_ROUNDS {
        while let Some(request) = db.engine(|engine| engine.push_request(PUSH_BATCH))? {
            let response = transport.push(&request)?;
            let outcome = db.engine(|engine| engine.apply_push_response(&response))?;
            if outcome.applied + outcome.duplicate + outcome.rejected == 0 {
                break;
            }
        }
        loop {
            let request = db.engine(|engine| engine.pull_request(PULL_LIMIT))?;
            let response = transport.pull(&request)?;
            let outcome = db.engine(|engine| engine.apply_pull_response(&response))?;
            report.changed_tables.extend(outcome.changed_tables);
            report.new_issues += outcome.new_issues;
            if !outcome.more {
                break;
            }
        }
        if db.engine(|engine| engine.push_request(1))?.is_none() {
            break;
        }
    }
    Ok(report)
}
