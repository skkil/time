use std::collections::HashMap;

use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::Value;

use crate::error::{Error, Result};
use crate::types::{Date, Timestamp};

const DEFAULT_URL: &str = "http://localhost:5600";
const VISIT_GAP_SECONDS: f64 = 60.0;

pub const WEB_BUCKET: &str = "web.tab.current";
pub const WINDOW_BUCKET: &str = "currentwindow";

#[derive(Debug, Clone, Deserialize)]
pub struct Event {
    pub timestamp: DateTime<Utc>,
    pub duration: f64,
    pub data: Value,
}

#[derive(Debug, Deserialize)]
struct Bucket {
    #[serde(rename = "type")]
    kind: String,
}

pub fn base_url() -> String {
    std::env::var("SKKIL_ACTIVITYWATCH_URL").unwrap_or_else(|_| DEFAULT_URL.to_owned())
}

fn unavailable(error: ureq::Error) -> Error {
    Error::invalid(format!("ActivityWatch isn't reachable: {error}"))
}

pub fn bucket_ids(kind: &str) -> Result<Vec<String>> {
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

pub fn normalize_domain(pattern: &str) -> String {
    let pattern = pattern.trim().to_lowercase();
    let pattern = pattern
        .split_once("://")
        .map_or(pattern.as_str(), |(_, rest)| rest);
    let host = pattern.split(['/', '?', '#']).next().unwrap_or_default();
    host.trim_start_matches("www.").to_owned()
}

fn host(url: &str) -> Option<String> {
    let (_, rest) = url.split_once("://")?;
    let host = rest.split(['/', '?', '#']).next()?;
    let host = host.rsplit_once('@').map_or(host, |(_, host)| host);
    let host = host.split(':').next()?;
    Some(host.to_lowercase().trim_start_matches("www.").to_owned())
}

pub fn matches_website(event: &Event, domains: &[String]) -> bool {
    let Some(host) = event.data.get("url").and_then(Value::as_str).and_then(host) else {
        return false;
    };
    domains
        .iter()
        .any(|domain| host == *domain || host.ends_with(&format!(".{domain}")))
}

pub fn matches_app(event: &Event, names: &[String]) -> bool {
    let field = |key: &str| {
        event
            .data
            .get(key)
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_lowercase()
    };
    let (app, title) = (field("app"), field("title"));
    names
        .iter()
        .map(|name| name.trim().to_lowercase())
        .filter(|name| !name.is_empty())
        .any(|name| app.contains(&name) || title.contains(&name))
}

#[derive(Debug, Default, Clone, Copy, PartialEq)]
pub struct Usage {
    pub seconds: f64,
    pub visits: u32,
}

pub fn usage_by_day(
    events: &[Event],
    matches: impl Fn(&Event) -> bool,
    days: &[Date],
) -> HashMap<Date, Usage> {
    let mut spans: Vec<(f64, f64)> = events
        .iter()
        .filter(|event| matches(event))
        .map(|event| {
            let start = event.timestamp.timestamp_millis() as f64 / 1000.0;
            (start, start + event.duration.max(0.0))
        })
        .collect();
    spans.sort_by(|a, b| a.0.total_cmp(&b.0));

    let mut result = HashMap::new();
    for day in days {
        let from = day.start().0 as f64;
        let to = Date(day.0.succ_opt().unwrap_or(day.0)).start().0 as f64;
        let mut usage = Usage::default();
        let mut last_end: Option<f64> = None;
        for &(start, end) in &spans {
            let inside = if start == end {
                (from..to).contains(&start)
            } else {
                start < to && end > from
            };
            if !inside {
                continue;
            }
            let (start, end) = (start.max(from), end.min(to));
            usage.seconds += end - start;
            if last_end.is_none_or(|last| start - last > VISIT_GAP_SECONDS) {
                usage.visits += 1;
            }
            last_end = Some(last_end.map_or(end, |last| last.max(end)));
        }
        result.insert(*day, usage);
    }
    result
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;
    use crate::types::date;

    fn event(day: Date, offset: i64, seconds: f64, data: Value) -> Event {
        Event {
            timestamp: DateTime::from_timestamp(day.start().0 + offset, 0).unwrap(),
            duration: seconds,
            data,
        }
    }

    #[test]
    fn normalizes_domains() {
        assert_eq!(
            normalize_domain("https://www.Reddit.com/r/rust"),
            "reddit.com"
        );
        assert_eq!(normalize_domain(" youtube.com "), "youtube.com");
    }

    #[test]
    fn matches_subdomains_but_not_lookalikes() {
        let domains = vec!["youtube.com".to_owned()];
        let at = |url: &str| event(date("2026-11-01"), 0, 1.0, json!({ "url": url }));
        assert!(matches_website(
            &at("https://www.youtube.com/watch?v=1"),
            &domains
        ));
        assert!(matches_website(&at("https://m.youtube.com/"), &domains));
        assert!(!matches_website(&at("https://notyoutube.com/"), &domains));
        assert!(!matches_website(&at("about:blank"), &domains));
    }

    #[test]
    fn matches_apps_by_name_or_title() {
        let names = vec!["discord".to_owned()];
        let window = |app: &str, title: &str| {
            event(
                date("2026-11-01"),
                0,
                1.0,
                json!({ "app": app, "title": title }),
            )
        };
        assert!(matches_app(&window("Discord", "#general"), &names));
        assert!(matches_app(
            &window("chromium", "Discord | Friends"),
            &names
        ));
        assert!(!matches_app(&window("kitty", "nvim"), &names));
    }

    #[test]
    fn splits_usage_across_days_and_counts_visits() {
        let first = date("2026-11-01");
        let second = date("2026-11-02");
        let url = json!({ "url": "https://reddit.com/" });
        let events = vec![
            event(first, 3600, 30.0, url.clone()),
            event(first, 3640, 30.0, url.clone()),
            event(first, 7200, 60.0, url.clone()),
            event(first, 86_400 - 30, 90.0, url.clone()),
            event(first, 5000, 600.0, json!({ "url": "https://docs.rs/" })),
        ];
        let domains = vec!["reddit.com".to_owned()];
        let usage = usage_by_day(&events, |e| matches_website(e, &domains), &[first, second]);
        assert_eq!(
            usage[&first],
            Usage {
                seconds: 150.0,
                visits: 3
            }
        );
        assert_eq!(
            usage[&second],
            Usage {
                seconds: 60.0,
                visits: 1
            }
        );
    }
}
