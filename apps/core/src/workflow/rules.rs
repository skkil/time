use super::model::{
    CATEGORIES, GROUPS, ICONS, ItemTypeInput, KINDS, LAYOUTS, MAX_CHECKLIST, MilestoneInput, SORTS,
    StatusInput, ViewInput,
};
use crate::error::{Error, Result};
use crate::validate::{optional_text, required_text};

fn one_of(value: &str, allowed: &[&str], what: &str) -> Result<()> {
    if allowed.contains(&value) {
        Ok(())
    } else {
        Err(Error::invalid(format!("Unknown {what}: {value}.")))
    }
}

pub fn check_type(input: &ItemTypeInput) -> Result<ItemTypeInput> {
    one_of(&input.kind, &KINDS, "kind")?;
    let icon = if ICONS.contains(&input.icon.as_str()) {
        input.icon.clone()
    } else {
        "circle".into()
    };
    if let Some(minutes) = input.default_minutes
        && !(1..=24 * 60).contains(&minutes)
    {
        return Err(Error::invalid("Default length is 1 minute to 24 hours."));
    }
    if input
        .checklist
        .lines()
        .filter(|l| !l.trim().is_empty())
        .count()
        > MAX_CHECKLIST
    {
        return Err(Error::invalid(format!(
            "A checklist has at most {MAX_CHECKLIST} items."
        )));
    }
    Ok(ItemTypeInput {
        name: required_text(&input.name, "Type name", 40)?,
        icon,
        kind: input.kind.clone(),
        default_minutes: input.default_minutes,
        checklist: optional_text(&input.checklist, "Checklist", 2000)?,
    })
}

pub fn check_status(input: &StatusInput) -> Result<StatusInput> {
    one_of(&input.category, &CATEGORIES, "category")?;
    Ok(StatusInput {
        name: required_text(&input.name, "Status name", 40)?,
        category: input.category.clone(),
    })
}

pub fn check_view(input: &ViewInput) -> Result<ViewInput> {
    one_of(&input.layout, &LAYOUTS, "layout")?;
    one_of(&input.group_by, &GROUPS, "grouping")?;
    one_of(&input.sort, &SORTS, "sort")?;
    serde_json::from_str::<serde_json::Value>(&input.filter)
        .map_err(|_| Error::invalid("The view's filter isn't valid."))?;
    Ok(ViewInput {
        name: required_text(&input.name, "View name", 40)?,
        ..input.clone()
    })
}

pub fn check_milestone(input: &MilestoneInput) -> Result<String> {
    required_text(&input.name, "Milestone name", 80)
}

pub fn check_milestone_label(label: &str) -> Result<String> {
    optional_text(label, "Milestone name", 40)
}
