# Addendum · Supporting people who work with parallel AI agents

_2026-10-18 · Extends `strategy-2026-10-18.md` · Decision served: how the product should change to serve AI-assisted solo builders · Staleness horizon: 60 days (this market moves monthly) · Evidence: `../../research/2026-10-18-ai-agent-attention-scan.md`_

## Bottom line

**Make AI-assisted builders the beachhead, and differentiate on the human side only: measure and protect the builder's attention across all their agent sessions and the rest of their screen. Do not build another agent dashboard or notifier.**

- **The agent side is taken.** Claude Code Projects, the Codex app, Cursor 3's Agents Window, GitHub mission control, Warp and a dozen indie tools already show "waiting on you" states [secondary: product docs, 2026-10].
- **The human side is empty.** No tool found measures time spent waiting, switching, reviewing or drifting across agent sessions [secondary: scan of ~20 tools, 2026-10].
- **Only your product would have both data sources,** agent events and general screen activity. "You opened YouTube 14 times while agents ran today" requires both. Platforms only see their own agent; screen-time apps don't see agents.

Confidence: moderate. The trend is well evidenced. The pain is credible but mostly anecdotal. Willingness to pay for this specific product is untested.

## 1. The audience is growing; the pain is real but under-measured

**Observations**
- Solo founders rose from 23.7% of new startups in 2019 to 36.3% in H1 2025 [secondary: Carta via search snippet, 2025-12]. They are 63% of Stripe Atlas C-corps in Q2 2026 [secondary: Stripe, 2026-05-28].
- 50.6% of professional developers use AI daily. 31% use AI agents, but only 14.1% use them daily [secondary: Stack Overflow survey, 2025-07].
- In a survey of 1,488 US workers, self-reported productivity fell at 4+ AI tools, and heavy AI oversight was linked to +12% mental fatigue [secondary: BCG/HBR via Fortune, 2026-03].
- Practitioners describe a ceiling of 2-4 parallel sessions [secondary: Willison, Osmani, HN threads, 2026]. Simon Willison: four parallel agents and "by like 11 AM, I am wiped out for the day" [secondary: Lenny's podcast, 2026-04-02].
- METR could not measure time for "developers who use multiple AI agents concurrently" [secondary: METR, 2026-02-24]. Even the best-funded researchers lack this data.

**Interpretation.** The pain has a clear shape: unpredictable waits, lost track of sessions, drift while waiting, and review debt. Nobody gives individuals their own numbers.

**Counter-evidence to keep in view**
- Daily agent use is still a minority (14.1%).
- Many developers fix this with workflow (one task at a time, plan first) rather than a tool: 7 of ~13 comments in one HN thread [secondary: HN, 2026].
- Platforms are improving their own session views monthly.

## 2. Where the product differs from every agent tool

| Question the user asks | Agent tools (Claude Code, Codex, Cursor, Warp, Conductor) | This product |
|---|---|---|
| Which session needs me? | ✓, per platform; Warp and GitHub cover several tools | Basic cross-tool list only. Not the selling point |
| How long did my agents wait on *me* today? | ✗ | ✓ Return time from "needs you" to response, per session |
| What did I do while they ran? | ✗ (they can't see the rest of the screen) | ✓ Wait time spent steering, reviewing or drifting (YouTube, X) |
| What's my personal session limit? | ✗ | ✓ "At 2 sessions, results get reviewed within 6 minutes. At 4+, return time triples" [assumption: example output] |
| Did my day go to what I intended? | ✗ | ✓ The existing intention vs. reality loop, now including agent work |
| How much finished but unreviewed work is piling up? | Partial: Projects shows "Ready for review" | ✓ Age of unreviewed results across all tools. Seen and handled are tracked separately (complaint in Claude Code issue #100228) |

## 3. Changes to the product

**New: an agent-aware timeline.** Each session is its own lane. Your own time is labeled steering, waiting, reviewing, elsewhere-productive or drift. Labels come from hook events plus window focus.

**New metrics.** These metrics are what an AI-written clone would not have:
- **Concurrent sessions** over the day
- **Switches per hour**
- **Return latency:** time from "agent needs you" to your response
- **Wait drift:** share of agent wait time spent on distracting apps or sites
- **Unreviewed age:** time from "finished" to you actually looking at the result

**New interventions.** All are opt-in and nudge rather than block, consistent with the main strategy:
1. **Personal session limit.** After 2 weeks of data, the app suggests your limit and nudges when you open one more session past it. This is a work-in-progress (WIP) limit from Kanban, set by your own data instead of a rule of thumb.
2. **Wait mode.** When an agent starts a long run and you switch to a distracting site, show the oldest unreviewed result instead.
3. **Batched "needs you" digest.** Collect agent requests into one alert every N minutes instead of constant pings. Off by default; some users want instant alerts.
4. **"Where was I" cards.** On returning to a session, show what it was doing and how long it waited. Built from metadata only, with no reading of prompts.

**Updated end-of-day review:** intentions vs. actual, sessions run, results reviewed vs. still open, and wait drift.

**Not building:**
- launching agents, managing worktrees, a terminal multiplexer, or replacing Claude Code/Codex UIs (Conductor and the platforms own this)
- reading prompts or responses
- web chat (ChatGPT/Claude.ai) tracking in v1, because it relies on reading page structure that changes weekly

## 4. How capture works

Most CLI agents now copy Claude Code's hook model: session start, prompt submitted, tool use, stop, session end, and a "needs input" notification [secondary: docs for Claude Code, Codex, Cursor, Gemini CLI, Copilot CLI and Windsurf, 2026-10].

- **Adapters (v1):** Claude Code, Codex, Cursor. Gemini CLI and Copilot CLI are cheap follow-ups with the same shape.
- **Ingress:** a tiny hook binary plus a localhost endpoint in the Tauri core. It exits in under 50ms so it never slows the agent, and it allowlists fields before anything is stored.
- **Installer:** shows a diff of each tool's user-level hooks config and merges into it, never overwrites. One-click uninstall.
- **Privacy:** store event type, timestamps, hashed session ID, the kind of wait (permission/question/idle) and the tool category. **Never** store prompts, responses, tool arguments or transcripts. Gemini CLI logs prompts to telemetry by default; the setup screen tells users to turn it off.
- **Hard part (moat):** matching agent events with which window has focus on macOS, Windows and Linux. This is what turns raw events into "return latency" and "unreviewed". The hook adapters alone could be copied in days.
- **Watch:** OSC 7501, a new terminal status standard (rev 0.4, 2026-10-10) with idle/working/blocked/done states. It's a week old, so don't depend on it yet.
- **Not covered by local hooks:** cloud agents (Codex cloud, Cursor cloud, Copilot cloud) need each vendor's API. Later, if ever.

## 5. Positioning and price

**Promise to test** [assumption]: _"Your agents work in parallel. You don't. See where your attention goes across every AI session, and find the number of agents you can actually run well."_

- **Category:** focus and time awareness for AI-assisted builders. Not "agent orchestration": that category is crowded and platform-owned.
- **Price:** keep the main plan's structure. Plus at ~$6-8/mo or ~$60/yr [estimate: Rize starts at $9.99/mo; this audience already pays $20-200/mo for Claude, ChatGPT or Cursor (official pricing pages, 2026-10); AgentNotch charges $9.99 one-time for notifications alone]. Free tier: one machine, 7 days, all metrics.
- **Distribution fit is better than the general desk-worker plan.** The audience gathers on HN, X and AI-tool Discords. "My own multi-agent attention data" also makes a strong build-in-public post.

## 6. Updated validation (replaces step 1 of the main plan)

| Step | How | Pass bar |
|---|---|---|
| 1. Instrument yourself | Add a Claude Code hook that appends event type + timestamp + session ID to a local file. Run ActivityWatch alongside. After 2 weeks, compute the five metrics in a notebook | At least 1 finding that surprises you and changes how many sessions you run |
| 2. Interviews | 8-10 developers who run 2+ agent sessions at once | 6+ name waiting, switching or review debt unprompted. Fewer than 4 means it's not felt; stop |
| 3. Landing page with two headlines | A: general time awareness; B: the AI-builder promise above | B gets at least 1.5x A's signup rate, and 300+ total signups |
| 4. Payment | Early-bird lifetime or deposit | 20+ commitments |

Step 1 is about an evening of work and needs no app. It is the cheapest test of whether this angle has value.

## 7. New risks

1. **Platforms add human-side analytics** (likely within 12-18 months for at least one platform [estimate]). Claude Code's telemetry already has an `active_time` metric split by user vs. CLI [secondary: Claude Code monitoring docs, 2026-10]. Defence: cross-tool coverage plus whole-screen drift data, which no single platform will have.
2. **The audience stays small** (roughly even chance [estimate]). Only 14.1% use agents daily today. Defence: the product still serves the general desk-worker segment from the main plan, and agent support is a mode within it.
3. **Hook churn.** Codex grew from 2 to 12 hook events during 2026. Defence: tolerant parsing, ignoring unknown events, and a version-tested matrix per tool.
4. **Workflow fixes win.** Users may decide "just run one agent" and need no tool. Defence: the personal-limit feature supports that choice with data instead of competing with it.

## Decisions, assumptions, next step

- **Proposed (your call):** beachhead = AI-assisted solo builders; v1 adapters = Claude Code, Codex, Cursor; no orchestration; metadata-only capture.
- **Riskiest assumption:** that seeing your own attention data changes behaviour enough to pay for it. Step 1 tests this on you first.
- **Next step:** instrument yourself this week (step 1).

## Gaps

- No data on how many developers run 2+ concurrent agent sessions.
- No traction numbers for Conductor, Claude Squad or the notifier apps.
- Unverified: whether hooks fire in the Claude Code desktop/web and Codex desktop apps; Cursor's waiting/permission events; Amp's events.
- Carta, JetBrains and HBR primary pages were blocked; their figures come from snippets or secondary coverage.
