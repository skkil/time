# skkil-time · Many projects, fast-but-slow agents, and how people track their lives

> **Update 2026-10-23:** founder confirmed the planner is required; Sunsama is the benchmark to beat. Parity list and build order (M1 planner + reality, M2 agent layer) in `REEVALUATION-SUNSAMA.md`. Items #6 and #7 move to P0.

_2026-10-23 · Jennifer (PM) · Evidence: 3 new research scans in `.jennifer/research/2026-10-23-{personal-tracking-systems,multi-project-overload,agent-wait-context-switching}.md` plus earlier scans · Lens roll seed 604608178 (physical-world version, 70-year-old user, flip the default, privacy; far domains: weather forecasting, improv)_

**Bottom line.** The thing that overwhelms you isn't the number of tasks or the number of agents. It's the number of **open loops**: contexts you've started, left, and must come back to. Agents create a new one every time you hand off work and walk away. The research is clear on what helps: write the next step down *before* you leave, keep the paused thing visible, get pulled back at a natural break, and deliberately close or drop loops instead of letting them rot. skkil-time should make that loop-closing its core job: **every open loop, yours and your agents', visible and closed on purpose.** That's a sharper target than "the ultimate productivity platform", and it is the version we can win.

## 1. One pushback first: don't aim for "ultimate productivity platform"

"Do everything" is the average of the category. It leads into fights with Notion, Todoist and Sunsama on their ground, with a solo side-project team (spec §14 already flags scope as the top risk). The evidence below points to one narrow, unclaimed job: **managing attention across many parallel contexts in the agent era.** Nobody owns it. Planners don't see agents. Agent tools (Claude Code Agent View, Projects) manage sessions, not a person's projects [secondary: multi-project scan, 2026-10-23]. Be the best at that, and integrate the rest (Todoist, Calendar, GitHub) instead of replacing it. I'll commit to whatever you decide, but this is my recommendation.

## 2. What the research says

### 2.1 How people track their lives

- **Your setup is the typical setup.** Popular systems stack the same layers: year or quarter goals → weekly plan → daily plan/log → habit grid → periodic review. Tools: Notion "Life OS", Obsidian periodic notes, Bullet Journal, 12 Week Year, PARA, Sunsama. They're spread across a notes tool, a task/calendar tool and a timer [secondary: personal-tracking scan, 2026-10-23].
- **Stopping is the normal outcome, not a failure.** In one study, 44-45% of activity and location trackers dropped their tool within 3 months, and most had already switched tools before. The four ways people lapse are forgetting, upkeep cost, skipping on purpose, and suspending [secondary: Epstein et al., UbiComp 2015]. About half of lapsed Fitbit users felt guilty, and most wanted to come back [secondary: Epstein et al. 2016, via press, retrieved 2026-10-23].
- **Heavy Notion systems cost the most upkeep.** One estimate is 1-2 h/week [secondary: vendor blog, retrieved 2026-10-23; low confidence]. The founder's manual Clockify → Notion copy is exactly this cost.
- **Long-term trackers keep it cheap:** a few minutes a day, coarse yes/no and 1-5 data, tolerance for missed days, and the weekly review as the anchor [secondary: practitioner accounts, retrieved 2026-10-23].
- **12 Week Year's "execution score"** (tactics done ÷ planned) is plan-vs-reality done by hand. **Korea:** 순공시간 (net study hours) is the core metric of study culture, and 스터디 인증 (posting proof of daily study) is a common social motivator [secondary: 서울연구원; app store].

### 2.2 Many projects at once

- **The count matters less than conflict and not letting go.** Conflicting goals go with more rumination and less action [secondary: Emmons & King 1988, via a secondary record]. The ability to *disengage* from dead goals and re-engage elsewhere goes with wellbeing [secondary: Wrosch 2003; Barlow meta-analysis].
- **Without help, people spend time on the nearest deadline, not the goal that matters most** [secondary: Schmidt & DeShon 2007; Ballard et al. 2018]. A student with courses, clubs, applications and side projects is exposed to exactly this.
- **Progress, not completion, drives wellbeing** (ρ ≈ .43 across 108 samples) [secondary: J. Happiness Studies 2015; search snippet only].
- **Switching leaves "attention residue"; a one-line ready-to-resume note reduces it** (4 studies, including a field survey of 202 people) [secondary: Leroy & Glomb 2018].
- **AI-era voices point one way, anecdotally:** "I've never accumulated half finished projects at a more impressive rate!" [anecdote: HN 45411282, 2025-09-29]. Others say agents helped them finish or revive old projects [anecdote: HN 46420316, 46928860].
- **Practitioner methods** (WIP limits, Burkeman's closed list, Duke's kill criteria, Shape Up appetite and cool-down, PARA projects vs areas) have plausible mechanisms. None has been tested on individuals.

### 2.3 "Fast but slow" agents

- **Waits are far past the point where attention holds.** Attention holds on a task for about 10 s [secondary: Nielsen, citing Miller 1968]. A median Claude Code turn is about 45 s, and the longest run past 40 min [secondary: Anthropic usage data, 2026]. Leaving during the wait is the normal response.
- **The human is the slow side.** In 13M Copilot agent sessions, a median 80.1% of a multi-turn session is the *user* idle between turns; model time is 13.7% [secondary: Microsoft 2026]. Your observation is right, and it's measurable.
- **The cost is mostly in not returning.** After an alert-driven switch, people spent ~10 min on the diversion, then 10-15 min more getting back to focused work. 27% of suspended tasks took over 2 h to resume, and users blamed lost context [secondary: Iqbal & Horvitz, CHI 2007, 27 users].
- **What works:**
  - Visible, specific resumption cues doubled success for interrupted programmers [secondary: DeLine & Parnin, Microsoft Research].
  - Paused windows that stay visible get resumed sooner [secondary: Iqbal & Horvitz 2007].
  - Interruptions at task breakpoints cost less [secondary: Iqbal & Bailey 2006/2008; search snippet only].
  - Small tasks are taken up best right after the hand-off [secondary: Cai et al., CHI 2015; tested on chat waits, not coding].
- **Platforms are covering part of this.** Claude Code's session recap shows a ≤400-character summary when you return after 3+ min [secondary: Claude Code docs, 2026]. Agent View groups sessions by state. The agent's side is being solved. **Your side is not:** what *you* meant to do, and what else you dropped while waiting.

## 3. What we build

### Bet 1 · The hand-off → wait → re-entry loop (answer to "fast but slow")

Every agent hand-off gets the same three-beat rhythm. It costs about 15 seconds and uses only words the user writes, so it stays inside POL-PRIV-02.

1. **Hand-off card (when you send a prompt).** A tray prompt fired by the `UserPromptSubmit` hook, which carries the event only, not its text. It asks two fields, both optional:
   - "When it's back, I'll check: ___" (an expected result, so you commit before seeing AI output; evidence A, Fogliato).
   - "While it runs: ___" (preset to the next small task *in the same project*).

   This is an if-then plan (implementation intentions, A) and a resumption cue written at the moment of leaving (memory-for-goals, A).
2. **Wait states by length.** An ETA forecast for each project comes from your own past turn lengths [assumption: turn length per project is predictable enough; check it in Phase 0 logs].

   | Expected wait | What the app does |
   |---|---|
   | under ~1 min | Nothing. Stay; your "I'll check" line sits in the tray |
   | 1-10 min | Offer the same-project wait task. Nothing from other projects |
   | over 10 min | Offer a deliberate switch with a resume note. A heads-up 1 min before the ETA, before the "done" alert |

   **The heads-up before "done"** is the weather service's split between a watch (it might need you soon) and a warning (it needs you now).
3. **Re-entry card (when you come back).** Triggered when the session's terminal regains focus (local window data) or when you click the alert. It shows your two lines, how long you were away, and a pointer to `/recap` for the agent's side. Think of a chess simul: every board shows its position, so walking back costs a glance.
4. **Alerts at breakpoints.** "Done" alerts arrive when you finish a task, commit, or switch windows, not mid-sentence. In focus blocks they're held, as already specced.

**New metric: lost returns.** These are sessions waiting on you for 2 h or more, the 27% tail in Iqbal & Horvitz. Show the count in Close the day and close each one with one tap: back to it tomorrow, park it, or drop it.

### Bet 2 · Count contexts, not agents

**Observation.** Running 3 agents *on one project* keeps one context. Running 3 agents *on 3 projects* means three contexts and three residues. The spec's concurrency limit (REQ-DO-04) counts sessions, which measures the wrong thing [assumption: no direct study; inferred from attention-residue and goal-conflict research].
**Recommendation.**
- **Contexts per hour.** Count the distinct projects you were in during an hour, from foreground app/cwd and agent sessions mapped to projects. This replaces "most agents at once" as the headline load number.
- **The tray limit counts projects with live sessions**, default 2.
- **One project per focus block, agents included.** Agents in that project run freely. Alerts from other projects are held until the block ends.
- **Brief → Build → Review blocks**, like a kitchen: fire all tickets, then cook, then pass the plates. Delegate the block's agent work in the first 15 min, do your own deep work, then review drafts in a batch. The existing Supervise/Review block types become this rhythm.

### Bet 3 · A project portfolio you prune on purpose

- **Projects ≠ areas.** Areas (each course, job search, Life) are ongoing and never "done". Projects (CLIP v2, SYNC scale-up, the internship application) are finite and have an outcome. This is the PARA split, and it matches your Todoist and Notion.
- **Active slots.** Each project is Active, Parked or Closed. You set how many can be active (suggest 3 for builders, but your call). A new idea goes to **Parked** with one line, which gets it out of your head (plan-making reduces intrusive thoughts, B). Activating one means parking another.
- **Kill criteria at creation** (optional): "I stop this if ___ by ___." The weekly review then runs an **edit**, borrowed from improv, where an edit cuts a scene once it's done: Continue, Park or Close for any active project with no progress for 2 weeks. Closing asks for "what I learned" and archives without guilt (disengagement research, A).
- **Deadline-pull check.** If a week's time went mostly to the nearest deadline while a weekly outcome got none, say so once in the review (Schmidt & DeShon, A).
- **Progress per outcome**, shown as a bar, not a done/not-done flag.

### Bet 4 · Tracking that survives lapses (from how people track)

- The daily input stays at one tap (felt rating) plus habits as yes/no plus one optional line. Everything else is captured.
- **After a gap, show what capture saw while you were away:** "4 days away: 11 h on CLIP, 6 h on courses." Ask nothing, then offer a fresh start. Never ask for backfill.
- Plan vs reality per week as a fraction ("18 of 24 blocks held"), never a grade.
- The weekly focused-hours headline maps to 순공시간 for Korean users, and the share card maps to 스터디 인증. Both are later options, not v1.

### "Now" screen (from the 70-year-old lens)

The tray and the top of Today answer three questions, nothing else: **Now** (one thing), **Next** (one thing), **Waiting on you** (n, oldest first). When everything is overwhelming, one screen tells you what to do.

## 4. Market-value test (bets 1-2, the wedge)

| | Answer |
|---|---|
| Who gains | Builders running agent sessions across 2+ projects; students and solo founders with many parallel commitments |
| How much | Iqbal & Horvitz's 10-25 min re-entry and 27% >2 h tail suggest tens of minutes a day for heavy agent users [estimate: from 2007 email/IDE data, not agent data; measure in Phase 0] |
| Why now | Agent turns grew long (99.9th percentile past 40 min, 2026), and parallel sessions became normal in 2026 |
| Why us | We're the only tool with plan + whole-screen capture + agent events, all local. Platforms see only their own agent; planners see no agent |
| Replaces | Notifier apps (AgentNotch, AgentBell), memory, sticky notes, Claude's recap alone |
| Cost | Bet 1: tray prompt, ETA model, re-entry card. Bet 2: project mapping (cwd → project), new metric. [Jennifer's guess: M together; Emil to size] |
| Risk | Claude Code adds "what you meant" notes or cross-session load views [estimate: likely within 12 months for the agent side, per the 10-18 addendum]. Our moat is the cross-tool, cross-project, plan-aware view |

## 5. How to test cheaply (fits Phase 0 step 1)

Use the hook logger you'd build anyway:

1. **Week 1, baseline.** Log `UserPromptSubmit`, `Notification`, `Stop` and window focus. Compute wait length, return latency, lost returns and contexts per hour.
2. **Week 2.** Turn on the hand-off card, as a terminal one-liner or a tray prompt.
3. **Compare return latency and lost returns.** Bet 1 passes if return latency or lost returns drop noticeably *and* you kept writing the card on most hand-offs. Set the threshold now, before you see the data.

Confidence: moderate on the mechanism (several A-grade lab and field studies), low on the size for agent waits (no study of developers waiting on agents exists). That gap is our opening and our risk.

## 6. What I'd not build

- **Micro-learning or "productive" content during waits.** Cai's work is about language learning during chat waits. Unrelated content creates a *new* context, which is the opposite of what we want.
- **An agent orchestrator or session dashboard.** Platform-owned, rejected 2026-10-18.
- **AI summarizing the agent's output on return.** It reads output (breaks POL-PRIV-02) and duplicates `/recap`.
- **Streaks or rankings for focused hours,** even though 열품타 uses them. They conflict with the shame guardrail. Revisit only for a Korean study segment.

## Decisions for you

1. Position as "open loops, yours and your agents', closed on purpose" instead of "ultimate productivity platform"?
2. Add Bets 1-3 to the spec as P0 (hand-off/re-entry, contexts metric) and P1 (portfolio slots, kill criteria)?
3. Run the 2-week self-test in §5 before Rebecca designs these?

## Gaps

- No study measures what developers do while an agent works, or the cost of returning to an agent session. Everything about agent waits is extrapolated.
- Several academic numbers were seen only in summaries (Gray 2017, the ρ = .43 progress meta-analysis, Iqbal & Bailey). They're marked; don't put them on a landing page.
- No Reddit/X data. Planner retention benchmarks are still missing.
