//! Reads events from the local ActivityWatch server
//! (`SKKIL_ACTIVITYWATCH_URL`, default `http://localhost:5600`).

use std::collections::HashMap;

use chrono::DateTime;
use serde::Deserialize;
use time_core::habits::activity::Event;
use time_core::types::Timestamp;
use time_core::{Error, Result};

const DEFAULT_URL: &str = "http://localhost:5600";

#[derive(Debug, Deserialize)]
struct Bucket {
    #[serde(rename = "type")]
    kind: String,
}

fn base_url() -> String {
    std::env::var("SKKIL_ACTIVITYWATCH_URL").unwrap_or_else(|_| DEFAULT_URL.to_owned())
}

fn unavailable(error: ureq::Error) -> Error {
    Error::invalid(format!("ActivityWatch isn't reachable: {error}"))
}

fn bucket_ids(kind: &str) -> Result<Vec<String>> {
    let buckets: HashMap<String, Bucket> = ureq::get(format!("{}/api/0/buckets/", base_url()))
        .call()
        .map_err(unavailable)?
        .body_mut()
        .read_json()
        .map_err(unavailable)?;
    Ok(buckets
        .into_iter()
        .filter(|(_, bucket)| bucket.kind == kind)
        .map(|(id, _)| id)
        .collect())
}

fn iso(timestamp: Timestamp) -> String {
    DateTime::from_timestamp(timestamp.0, 0)
        .unwrap_or_default()
        .to_rfc3339()
}

/// Every event between `start` and `end` in the buckets of one kind.
pub fn events(kind: &str, start: Timestamp, end: Timestamp) -> Result<Vec<Event>> {
    let mut all = Vec::new();
    for bucket in bucket_ids(kind)? {
        let events: Vec<Event> = ureq::get(format!("{}/api/0/buckets/{bucket}/events", base_url()))
            .query("start", iso(start))
            .query("end", iso(end))
            .query("limit", "-1")
            .call()
            .map_err(unavailable)?
            .body_mut()
            .read_json()
            .map_err(unavailable)?;
        all.extend(events);
    }
    Ok(all)
}
