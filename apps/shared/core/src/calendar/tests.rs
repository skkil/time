use rusqlite::{Connection, params};

use super::*;
use crate::data::{self, LocalData, TableRows, delete_all, dump};
use crate::env::NaturalKey;
use crate::error::Result;
use crate::testing::{db, env, missing_id};
use crate::types::{Id, date};

const ACCOUNT: &str = "019a6c00-0000-7000-8000-0000000000a1";

fn source(conn: &Connection, id: &str, name: &str, position: i32) -> Result<Id> {
    conn.execute(
        "INSERT INTO calendar_source (id, account_id, external_id, name, color, position)
         VALUES (?1, ?2, ?3, ?3, '#039be5', ?4)",
        params![id, ACCOUNT, name, position],
    )?;
    Ok(Id::parse(id).unwrap())
}

fn event(
    conn: &Connection,
    source: &Id,
    title: &str,
    span: (i64, i64),
    all_day: bool,
) -> Result<()> {
    event_with(conn, source, title, span, all_day, "confirmed")
}

fn event_with(
    conn: &Connection,
    source: &Id,
    title: &str,
    (start, end): (i64, i64),
    all_day: bool,
    status: &str,
) -> Result<()> {
    conn.execute(
        "INSERT INTO calendar_event
           (id, source_id, external_id, title, start_at, end_at, all_day, location, link, status,
            updated_at)
         VALUES (?1, ?2, ?3, ?3, ?4, ?5, ?6, 'Room 4', 'https://calendar.google.com/e', ?7, 0)",
        params![
            Id::from(uuid::Uuid::now_v7()),
            source,
            title,
            start,
            end,
            all_day,
            status
        ],
    )?;
    Ok(())
}

fn utc_midnight(day: &str) -> i64 {
    date(day)
        .0
        .and_hms_opt(0, 0, 0)
        .unwrap()
        .and_utc()
        .timestamp()
}

#[test]
fn lists_events_that_overlap_the_range_from_visible_calendars() {
    db().call(|conn| {
        let work = source(conn, "019a6c00-0000-7000-8000-0000000000c1", "Work", 0)?;
        let family = source(conn, "019a6c00-0000-7000-8000-0000000000c2", "Family", 1)?;
        let monday = date("2026-11-09");
        let nine = monday.start().0 + 9 * 3600;
        event(conn, &work, "Standup", (nine, nine + 1800), false)?;
        event(
            conn,
            &work,
            "Late call",
            (monday.start().0 - 1800, monday.start().0 + 1800),
            false,
        )?;
        event(
            conn,
            &work,
            "Next week",
            (nine + 7 * 86_400, nine + 7 * 86_400 + 1800),
            false,
        )?;
        event_with(
            conn,
            &work,
            "Moved",
            (nine, nine + 1800),
            false,
            "cancelled",
        )?;
        event_with(
            conn,
            &work,
            "Maybe",
            (nine + 3600, nine + 5400),
            false,
            "tentative",
        )?;
        event(
            conn,
            &family,
            "Trip",
            (utc_midnight("2026-11-12"), utc_midnight("2026-11-14")),
            true,
        )?;
        event(
            conn,
            &family,
            "Dinner",
            (nine + 36_000, nine + 39_600),
            false,
        )?;

        let week = events(conn, monday, monday.add_days(7))?;
        let titles: Vec<&str> = week.iter().map(|event| event.title.as_str()).collect();
        assert_eq!(titles, ["Trip", "Late call", "Standup", "Maybe", "Dinner"]);
        let trip = &week[0];
        assert!(trip.all_day);
        assert_eq!(trip.start_date, Some(date("2026-11-12")));
        assert_eq!(trip.end_date, Some(date("2026-11-14")));
        assert_eq!(trip.start_at, date("2026-11-12").start());
        assert_eq!(trip.source_name, "Family");
        assert!(week[3].tentative && !week[2].tentative);
        assert_eq!(week[2].location.as_deref(), Some("Room 4"));

        set_visible(conn, &family, false)?;
        let titles: Vec<String> = events(conn, monday, monday.add_days(7))?
            .into_iter()
            .map(|event| event.title)
            .collect();
        assert_eq!(titles, ["Late call", "Standup", "Maybe"]);
        let before: Vec<String> = events(conn, monday.add_days(-1), monday)?
            .into_iter()
            .map(|event| event.title)
            .collect();
        assert_eq!(before, ["Late call"]);
        Ok(())
    })
    .unwrap();
}

#[test]
fn an_all_day_event_covers_its_days_only() {
    db().call(|conn| {
        let work = source(conn, "019a6c00-0000-7000-8000-0000000000c1", "Work", 0)?;
        event(
            conn,
            &work,
            "Holiday",
            (utc_midnight("2026-11-11"), utc_midnight("2026-11-12")),
            true,
        )?;
        assert_eq!(
            events(conn, date("2026-11-11"), date("2026-11-12"))?.len(),
            1
        );
        assert!(events(conn, date("2026-11-10"), date("2026-11-11"))?.is_empty());
        assert!(events(conn, date("2026-11-12"), date("2026-11-13"))?.is_empty());
        Ok(())
    })
    .unwrap();
}

#[test]
fn sources_list_by_position_and_hide_or_show() {
    db().call(|conn| {
        let b = source(conn, "019a6c00-0000-7000-8000-0000000000c2", "B", 1)?;
        source(conn, "019a6c00-0000-7000-8000-0000000000c1", "A", 0)?;
        let names: Vec<String> = sources(conn)?.into_iter().map(|s| s.name).collect();
        assert_eq!(names, ["A", "B"]);
        let hidden = set_visible(conn, &b, false)?;
        assert!(!hidden.visible);
        assert_eq!(hidden.account_id.as_str(), ACCOUNT);
        assert!(set_visible(conn, &b, true)?.visible);
        assert!(set_visible(conn, &missing_id(), false).is_err());
        Ok(())
    })
    .unwrap();
}

#[test]
fn connected_calendars_stay_out_of_uploads_and_wipes() {
    db().call(|conn| {
        let work = source(conn, "019a6c00-0000-7000-8000-0000000000c1", "Work", 0)?;
        event(conn, &work, "Standup", (3600, 5400), false)?;
        assert!(
            dump(conn)?
                .tables
                .iter()
                .all(|table| !data::is_connected(&table.table))
        );

        let upload = LocalData {
            tables: vec![TableRows {
                table: "calendar_source".to_owned(),
                rows: Vec::new(),
            }],
        };
        assert!(data::import(conn, &env(), &upload).is_err());

        delete_all(conn)?;
        assert_eq!(sources(conn)?.len(), 1);
        assert_eq!(
            events(conn, date("1970-01-01"), date("1970-01-02"))?.len(),
            1
        );
        Ok(())
    })
    .unwrap();
}

#[test]
fn ids_follow_the_natural_keys_the_server_uses() {
    let scope = uuid::Uuid::parse_str("0192f0c1-7a2b-7c3d-8e4f-0123456789ab").unwrap();
    let account = Id::parse(ACCOUNT).unwrap();
    let source = NaturalKey::CalendarSource(&account, "ada@example.com").id(scope);
    let event = NaturalKey::CalendarEvent(&source, "abc_20261110T090000Z");
    assert_eq!(
        event.name(),
        format!("calendar_event/{source}/abc_20261110T090000Z")
    );
    assert_ne!(event.id(scope), source);
}
