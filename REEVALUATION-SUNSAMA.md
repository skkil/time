# skkil-time · Re-evaluation after Sunsama

_2026-10-23 · Jennifer (PM) · **Decision (founder, 2026-10-23): the planner is required.** skkil-time stays a full planner. Sunsama is the benchmark to beat, not a tool to integrate with. Sources retrieved 2026-10-23, listed at the end._

**Bottom line.** Sunsama shows what a good planner has to have, and anyone who might switch from it will expect that much. Our edge is everything it can't see: actual time without timers, agent sessions, blocking, and an honest review. That gives the strategy one line: **Sunsama's rituals, plus the reality it can't capture, at about half the price, local-first, on Linux.** In practice this means: match Sunsama on the daily loop, beat it on reality and agents, and skip its long tail of integrations. It also changes the build order: planner + reality first (you can dogfood it), agent layer second.

## 1. Sunsama vs. our spec

| Area | Sunsama today | What we do |
|---|---|---|
| Guided daily planning, overcommit warning, timeboxing | Core | **Match.** We have the pieces (REQ-PLAN-03/04/09) but no guided flow yet |
| Two-way calendar sync (Google/Outlook/Apple) | Yes | **Match for Google in P0.** Our calendar write is P1 (REQ-PLAN-08); move one-way block mirroring to P0 |
| Weekly objectives + weekly planning | Yes | **Match + beat.** Max 3 outcomes, plus a quarter layer and a review built from data |
| Pull tasks from GitHub, Linear, Todoist, Gmail, Slack | Yes, broad | **Partial.** GitHub Issues + Todoist only. No email/Slack |
| Shutdown ritual | Yes | **Beat:** felt rating first, then plan vs reality computed for you |
| Focus mode / focus bar, Slack status sync | Yes | **Match** (tray = focus bar), **beat** with held agent alerts and blocking |
| **Actual time** | Manual (`E`), a timer you start (`Space`), or "count planned as actual" | **Beat: passive capture, no timers.** Offline focus confirmed in one tap |
| **Distraction blocking** | Not built; requested on its roadmap | **Beat:** opt-in hard block in focus blocks (desktop) |
| **Agent sessions** | None | **Our wedge:** hand-off/re-entry, review inbox, contexts per hour, lost returns |
| Habits, quarter view | Not seen on its site [gap: not verified] | Build light (yes/no habits in day close, quarter header) |
| Mobile | Has apps; mobile editing criticized [anecdote: App Store review, 2026] | P2 |
| Privacy / platform | Cloud; Linux app | **Beat:** local-first, Linux + macOS first |
| Price | $17/$22 on the plan card, $20/$25 in its FAQ; no free plan | **Beat:** free core + Plus ~$10 (spec §11) |

## 2. The "would you switch from Sunsama?" bar

This is the minimum someone with Sunsama habits needs before they'll switch. It's also your own bar for replacing Notion + Todoist + Clockify. All P0:

1. **Guided daily plan** (≤2 min): yesterday's carry-overs with resume notes, today's calendar, backlog with outcomes first, overcommit warning, drag into blocks. *(Restores IMPROVEMENTS #6.)*
2. **Week-planning screen:** quarter priorities → ≤3 outcomes → week grid with deadlines and recurring classes. *(Restores #7.)*
3. **Google Calendar: read, plus a one-way mirror of blocks to one calendar** (REQ-PLAN-08 moves P1 → P0). Your plan then shows on your phone without a mobile app.
4. **Keyboard-first task capture** with `~30m #project`. Recurring tasks and blocks. Projects/areas (Sunsama's "channels"; your courses, STiTy, CLIP).
5. **Tray focus bar**: current block, time left, start/switch/stop.
6. **Day close and week review** as already designed, plus habits, the three reflection prompts and the quarter strip (IMPROVEMENTS §6).
7. **Import:** Todoist (yours) and GitHub Issues (beachhead). Both in P0 for dogfooding; Linear later.

Not required to switch, so not built: Gmail/Slack/Asana/Jira/ClickUp integrations, Slack status sync, AI summaries, team features.

## 3. Build order (this changes, because the planner stays)

| Milestone | Contents | Gate |
|---|---|---|
| **M1 · Planner + reality** (dogfood) | §2 list + passive capture + offline focus + focused hours + blocking + day close + week review | You stop opening Notion, Todoist and Clockify for 2 weeks |
| **M2 · Agent layer** (the launch wedge) | Draft-trigger fix, `skkil` CLI + `/skkil`, hand-off → re-entry, review inbox, contexts per hour, lost returns, MCP | Your 2-week self-test shows lower return latency or fewer lost returns (OPEN-LOOPS §5) |
| **M3 · Public beta** | Onboarding, sync (Plus), share card, Windows | Spec §13 Phase 1 gates |

**Why this order:** M1 is the part you'd use every day right now, because your current tracking has no agents in it. Without daily use, dogfooding stalls. M2 is what makes it worth switching from Sunsama, so it has to land before any public launch.

**The cost is real.** M1 alone is a full planner. My T-shirt guess is L for M1 and M for M2; Emil to size. The spec's #1 risk (scope) gets worse, not better. Mitigations:
- ActivityWatch as the capture backend.
- Google-only calendar.
- No mobile.
- A narrow integration list.

## 4. What stays the same from earlier docs

- IMPROVEMENTS §2 (draft trigger, first run, CLI, insight + experiment, no paywall on adapters) and §4 (cut the Board, confirm carry-overs, GNOME Wayland decision).
- IMPROVEMENTS §6 (your setup → product), except "Todoist import P0" now covers GitHub Issues too.
- OPEN-LOOPS Bets 1-4. One pushback still stands: position as "open loops, yours and your agents', closed on purpose," with the planner as the base.

## 5. Next steps

1. **Optional, for you:** a 14-day Sunsama trial (free, no card) *as competitor research*: time its daily plan and shutdown, and note what you'd steal and what annoys you. Rebecca can use that note as a UX benchmark.
2. **Me:** update spec v1 → v1.1 (§2 parity list into P0, calendar mirror P0, M1/M2/M3 order). Then a design brief for Rebecca on the three missing screens: daily plan, week plan, quarter.
3. **Emil:** size M1 and M2.

## Gaps

- Not verified: Sunsama habits, quarter view, how its Toggl integration works.
- Sunsama's price contradicts itself on its own page.
- No direct data on why Sunsama users churn; the "switching bar" is my judgment [assumption: validate in Phase 0 interviews by asking current Sunsama/Akiflow users what made them pick it].

## Sources (retrieved 2026-10-23)

[Sunsama home](https://www.sunsama.com/) · [Pricing](https://www.sunsama.com/pricing) · [MCP help](https://help.sunsama.com/docs/integrations/mcp) · [Planned and actual times](https://help.sunsama.com/docs/usage-guides/tasks/planned-and-actual-times) · [Focus bar](https://help.sunsama.com/docs/focus-bar) · [Roadmap: block distractions](https://roadmap.sunsama.com/improvements/p/block-distractions-when-in-focus-mode) · [Morgen: Sunsama pricing 2026](https://www.morgen.so/blog-posts/sunsama-pricing) (competitor source) · `.jennifer/research/2026-10-23-planner-competitor-landscape.md`
