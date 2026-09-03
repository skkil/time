# Planner / task / time-blocking competitor landscape (2026)

Retrieved: 2026-10-23. Prices are USD list prices from official pages unless marked otherwise. Anything I could not fetch from a primary source is marked **unverified**.

## Bottom line

- The category has split into two groups. **Ritual planners** (Sunsama, Akiflow, Morgen, Amie) cost $15–34/mo. **Cheap task lists** (Todoist, TickTick, Superlist, Routine) cost $4–7/mo. Motion and Reclaim have moved toward teams and "AI agents" for businesses, and Clockwise shut down on 2026-03-27.
- **MCP is now standard.** Todoist, Sunsama, Akiflow, Amie, Superlist, Routine, Notion, Rize and Reclaim all have official MCP servers or connectors, and most can read and write. An "MCP server" on its own is no longer a differentiator.
- **Nobody connects plan, reality and agents.** No product checked does all three of: (1) tasks, time blocking and a weekly review; (2) passive capture of what actually happened (Rize and ActivityWatch do capture, but have no planning); (3) awareness of AI-agent sessions as work you delegated. Coding-agent awareness exists only in dev tooling (Vibe Kanban, Claude Code telemetry dashboards), with no tie to a personal plan.
- **Price, reliability and paywalls drive complaints, not missing features.** In 710 recent 1–2★ App Store reviews across 9 apps, 42% mention price or paywall, 25% calendar integration, and 23% bugs or sync.

## Comparison table

Legend: Y = yes, P = partial, N = no, ? = unverified. "Agents API" means an official MCP server or public API. TB = time blocking.

| Product | Platforms (Linux?) | Cheapest paid (mo / annual-eq.) | Tasks | TB | Daily ritual | Weekly ritual | Planned vs actual / tracking | AI | Agents API | Coding-agent tie-in |
|---|---|---|---|---|---|---|---|---|---|---|
| Todoist | Win/Mac/**Linux**/iOS/Android/Watch | $7 / $5 | Y | P (calendar layout, durations) | N | N | N | Todoist Assist, Ramble voice→tasks | **Official MCP** (hosted, R/W) + REST API | Claude Code plugin |
| TickTick | Win/Mac/**Linux**/mobile | ? / $49.99/yr ($4.17) | Y | P manual | N | N | P (focus timer) | ? (listed, tier unclear) | Open API; community MCPs only | N |
| Things 3 | Apple only | one-time $49.99 Mac + $9.99 iPhone (3rd-party, **unverified**) | Y | N | P (Today) | N | N | N | N (URL scheme/Shortcuts) | N |
| Sunsama | Win/Mac/**Linux**/mobile | $22 / $17 (FAQ says $25/$20; conflict) | Y | Y manual | **Y** | P (weekly objectives) | **Y planned vs actual** | AI summaries | **Official MCP** (hosted) | N |
| Motion | Web/desktop/mobile | $19/seat (Pro AI; annual "save 33%") | Y | **Y auto** | P | N | Business tier only | AI chat, task planner, workflows; credit-metered | Public API; no official MCP found | N |
| Akiflow | Mac/Win/web/mobile (no Linux listed) | $34 / $19 | Y | Y manual + auto | Y ("Daily Rituals") | P (auto week plan) | N | Aki assistant, briefings, voice | **Official MCP** (included) | Marketed for Cursor (3rd-party listing) |
| Reclaim (Dropbox) | Web + Google/Outlook | $12 / $10 (free Lite) | P (syncs from Todoist/Linear/etc.) | **Y auto** | P (agent) | N | P (AI time analytics, not plan vs actual) | "AI agents" library (focus, habits, buffers) | **Claude/Claude Code MCP** (listed) + webhooks | Listed Claude Code MCP |
| Morgen | Win/Mac/**Linux**/web/mobile | $30 / $15 | P (aggregates tasks) | Y AI-proposed, user-approved | **Y** | ? | N | AI Planner ("Frames") | ? (no official MCP found) | N |
| Amie | Mac/iOS/web | **unverified** (sources: $8–25) | Y | Y | ? | ? | N | AI scheduling, meeting notes, chat | **Official MCP** (R/W todos, events) | Names Claude, Codex, Cursor |
| Structured | iOS/web/Watch | **unverified** (official help pages conflict: $2.99–6.49/mo, $9.99–19.99/yr, lifetime $29.99–64.99) | Y | Y timeline | P | N | N | "Plan with AI" | N | N |
| Tiimo | iOS/Android/Mac/web | not listed (regional) | Y | Y visual | Y | N | N | AI plan builder + time estimates | N | N |
| Routine | Mac/Win/**Linux**/web/mobile | $5 (time blocking tier) | Y | Y | ? | ? | Y (Professional, $10) | Assistant, agents, meeting notes | **MCP live**; public API "soon" | N |
| Superlist | Mac/iOS/Android/web | $5 / ~$4.9 | Y | N | P (Today) | N | N | Voice AI, Make AI, summaries | **Official MCP** (R/W) | Names Cursor |
| Notion + Notion Calendar | Win/Mac/web/mobile (no native Linux) | Plus ₩14,000/member (USD **unverified**) | Y (DBs) | P (Calendar) | N | N | N | Notion Agent (Business): calendar tools, scheduling | **Official hosted MCP** (R/W, incl. calendar tools) | Docs name Claude Code, Cursor, Codex |
| Llama Life | web/iOS | **unverified** | Y | P (timed list) | Y | N | P (timers) | ? | ? | N |
| Saner.ai | web/Chrome/mobile | $8 (Starter) | Y | ? | P (proactive AI) | N | N | Chat, reasoning, ADHD positioning | None mentioned | N |
| Rize | Mac/Win (**Linux "coming soon"**) | $12.99 / $9.99 | N | N | N | N | **Y passive auto-capture** | Auto-categorize, chat, agents | **Official MCP (beta, Apr 2026)**, API on Pro+ | N |
| ActivityWatch | Win/Mac/**Linux**/Android | Free (OSS); Pro from $5 | N | N | N | N | **Y passive, local-first** | N | Local REST (docs) | N |
| Clockwise | — | **Shut down 2026-03-27** (team joined Salesforce) | — | — | — | — | — | — | — | — |

## Per-product notes

- **Todoist**: market-leading list. Pro went to $5/mo (annual) from $4 on 2025-12-10. Ramble (Jan 2026) is voice-to-tasks via Gemini. Doist's MCP (`ai.todoist.net/mcp`, OAuth, 562★ repo) exposes rich read/write tools, including activity and productivity stats. No time capture and no weekly review.
- **TickTick**: cheapest full-featured option, with a native Linux app. MCPs are community-built only.
- **Things 3**: Apple-only, one-time purchase. 3.23 shipped Aug 2026 with recurring-task rework (single press source, unverified). No agent surface.
- **Sunsama**: the closest match for "ritual + planned vs actual", with daily start/shutdown, weekly objectives, actual-time overlay and a Linux app. Official MCP at `api.sunsama.com/mcp`. Price is the top objection: the pricing card and FAQ disagree ($17–25), and a competitor blog reports a 2026 increase.
- **Motion**: pivoted to an "AI SuperApp for Work" and AI Employees. Raised $60M at a $550M valuation (Sept 2025). Pricing is credit-metered and per seat. A recent App Store review calls it "Abandonware… no update… for almost a year" ([US App Store, review 14601276929, 2026-09-27](https://apps.apple.com/us/app/id1580440623?see-all=reviews)).
- **Akiflow**: priciest monthly plan ($34). Its MCP connector is included in Pro and launched around June 2026 (third-party coverage). No free plan; 7-day trial with card required.
- **Reclaim**: acquired by Dropbox in Aug 2024 and named by Clockwise as its replacement. Positioned as a team calendar with an "AI agent library". Analytics cover where time went, not plan versus actual.
- **Morgen**: AI Planner proposes, the user approves. Linux app. Monthly price doubled relative to annual ($30 vs $15).
- **Amie**: pivoted toward meeting notes plus an MCP. Of all the products checked, its MCP is the most explicitly agent-native: it names Claude, Codex and Cursor. Price unverified.
- **Tiimo**: won 2025 iPhone App of the Year. Its AI planner draws heavy criticism in reviews (see below).
- **Structured**: 15M+ downloads (self-reported). The free tier paywalls recurring tasks, which is the dominant complaint.
- **Routine**: Linux app, $5 time blocking, time tracking at $10, MCP live.
- **Rize**: the strongest passive-capture product, with an MCP server (42 tools). It has no planning and no Linux support yet.
- **Notion**: hosted MCP with calendar create/list/update tools (I saw these in this environment's Notion MCP tool list). Notion Agent calendar tools shipped 2026-04/07.
- **New 2025–26 entrants and adjacent tools**: Vibe Kanban (kanban for Claude Code/Codex/Gemini agents; its company, bloop, shut down in 2026 and the project is now community OSS). Claude Code time dashboards include hep.gg, the Grafana "Claude Code Metrics" board and the local `claude-analytics`. Lifestack offers energy-aware AI planning. No 2026 entrant combines personal planning with agent awareness.

## Voice of customer: complaint themes

**Method.** I pulled the most recent App Store (US) reviews through Apple's public RSS feed for 9 apps: Motion, Sunsama, Akiflow, Todoist, TickTick, Structured, Tiimo, Morgen and Amie. That gave 2,769 reviews; the 1–2★ subset is **N = 710**. Each review was coded by keyword regex, so the counts are approximate and one review can carry several themes. Reddit is blocked to my crawler, so **no Reddit data was collected**. A Hacker News Algolia pull of 245 comments mentioning these tools surfaced too few complaints to count.

| # | Theme | 1–2★ count (of 710) | Concentrated in |
|---|---|---|---|
| 1 | Price, subscription, paywall, billing or refund | 295 (42%) | Motion 106, Tiimo 61, Structured 45, Todoist 29 |
| 2 | Calendar integration gaps | 174 (25%) | Motion 50, Tiimo 48, Structured 20 |
| 3 | Bugs, crashes, sync, reliability | 163 (23%) | Tiimo 51, Todoist 36 (iOS crash wave, Sept 2026) |
| 4 | AI that is bad or unwanted ("AI for the sake of AI") | 117 (16%) | Tiimo 56, Motion 41 |
| 5 | Mobile/desktop parity and platform gaps | 96 (14%) | Sunsama 14 (mobile weak), Morgen 7 |
| 6 | Support or cancellation trouble | 87 (12%) | Motion 44 |
| 7 | Complexity and setup overhead ("planning becomes the work") | 54 (8%) | Motion |
| 8 | Auto-schedule doing the wrong thing | 19 (3%) | Motion, Akiflow |

Representative real quotes (US App Store; individual reviews have no permalinks, so the ID is given and the reviews are retrievable via `https://itunes.apple.com/us/rss/customerreviews/id=<app>/sortby=mostrecent/json`):
- Motion (id1580440623), review 11040928632: "This is probably the worst app imaginable for ADHD just because it is comically complicated to set up."
- Tiimo (id1480220328), review 14645799582: "I spent 30 mins trying to get a reasonable morning plan. I had to keep having them do it over and over."
- Tiimo, review 13524036827: "Could easily be a single buy and on device. AI for the sake of AI."
- Structured (id1499198946), review 13785577118: "You cannot make a reoccurring schedule without paying a subscription."
- Sunsama (id1475755747), review 13716009939: "Mobile app is near unusable for task editing/addition."
- HN, "too many apps": "They all solve one piece of the puzzle but nothing tied it all together… at the end of the month I had no idea if I was actually making progress" ([HN 47641840](https://news.ycombinator.com/item?id=47641840), 2026-04-04).
- HN: "The main thing most task or calendar apps have failed on for me is when tasks and calendars are completely unaware of the other" ([HN 40168024](https://news.ycombinator.com/item?id=40168024)).

**Paraphrase, not counted.** ADHD writers describe planners dying after about 2 weeks because the novelty fades and backfilling missed days turns into admin ([Substack](https://adhdwithouttheguilt.substack.com/p/why-every-planner-dies-after-2-weeks), D). The "planned vs actual / no reality check" theme barely appears in reviews: it is a latent need, not a voiced complaint.

## Pricing benchmark (cheapest paid individual tier, USD)

| Band | Monthly billing | Annual-equivalent | Products |
|---|---|---|---|
| Budget lists | $5–7 | $4–5 | TickTick ($4.17), Todoist ($5/$7), Superlist ($5), Routine ($5) |
| Trackers | $10–13 | $10 | Rize ($9.99/$12.99), Reclaim Starter ($10/$12) |
| Ritual / AI planners | $19–34 | $15–19 | Morgen ($15/$30), Sunsama ($17–20 / $22–25), Akiflow ($19/$34), Motion ($19/seat, credits) |
| One-time | — | — | Things (~$50 Mac + $10 iPhone, unverified), Structured lifetime (unverified) |

Takeaway: **$10–15/mo annual** sits in an empty band between budget lists and ritual planners. The ritual planners' monthly prices ($22–34) are the most-cited pain point.

## White-space analysis

| Capability | Who has it |
|---|---|
| (a) Tasks + time blocking + weekly review | Sunsama (weekly objectives; P), Akiflow (P), Morgen (daily only). None does a **data-backed** weekly review. |
| (b) Passive capture of what actually happened | Rize (Mac/Win, cloud), ActivityWatch (local-first, Linux, no planning). Sunsama's "actual" time is manual or timer-based. |
| (c) Awareness of AI-agent work and delegation | None in planners. Dev tools only: Vibe Kanban, Claude Code OTel/Grafana dashboards, hep.gg. |
| (d) MCP for agents | Common: Todoist, Sunsama, Akiflow, Amie, Superlist, Routine, Notion, Rize, Reclaim. |

- **(a)+(b)**: no product. Sunsama comes closest, but its "actual" is manual. Rize has capture but no plan.
- **(a)+(b)+(d)**: no product.
- **(a)+(b)+(c)+(d)**: no product. Adding **local-first and Linux** narrows the field further: only ActivityWatch (capture only) and Linux-capable planners (Todoist, TickTick, Sunsama, Morgen, Routine) are close, and none of them captures passively.
- **How agents are used with task managers today.** Users connect Claude, ChatGPT or Cursor to an official hosted MCP (Todoist, Sunsama, Akiflow, Amie, Notion) to read today's list, create tasks from documents or meetings, reschedule, and run weekly reviews over completed-task activity. Doist's MCP exposes `find-activity` and `get-productivity-stats`, which were visible in this environment's tool list. The agent is a **client** of the planner. No product treats agent sessions as **work items whose time and outcomes are captured** into the plan.
- **Implication for skkil-time.** MCP is table stakes, not a moat. The defensible wedge is (b)+(c): local, passive planned-vs-actual that also counts the agent sessions you delegated, feeding a weekly review. Pricing in the $10–15 band would undercut the ritual planners.

## Gaps and caveats

- **Unverified**: prices for Things, Amie, Structured, Tiimo, Llama Life and Notion (USD); TickTick's AI tier; Morgen MCP and API; Akiflow MCP details (third-party sources only); Saner.ai platforms.
- Sunsama's official page contradicts itself on price ($17/$22 on the plan card vs $20/$25 in the FAQ).
- Motion's pricing page shows "This plan is not available" on both plans, so its individual offering may be in flux.
- No Reddit or G2 data (crawler blocked). The VOC figures are App Store (US) only, recent-skewed, and keyword-coded.
- User counts and funding not re-checked, except Motion's $60M/$550M (press release) and Reclaim's acquisition.

## Sources

**A: official pages and filings**
- Todoist: [pricing](https://www.todoist.com/pricing), [2025 price update](https://www.todoist.com/help/account-and-billing/plans/todoist-pro-pricing-update-in-2025-bxBvHZuJZ), [downloads](https://www.todoist.com/downloads), [Doist/todoist-mcp](https://github.com/Doist/todoist-mcp)
- [TickTick upgrade](https://ticktick.com/about/upgrade), [TickTick download](https://ticktick.com/download)
- Sunsama: [pricing](https://www.sunsama.com/pricing), [home](https://www.sunsama.com/), [MCP docs](https://help.sunsama.com/docs/integrations/mcp)
- Motion: [pricing](https://www.usemotion.com/pricing), [home](https://www.usemotion.com/), [Series C press release](https://www.businesswire.com/news/home/20250905188051/en/Motion-Raises-$60M-at-$550M-Valuation-to-Build-the-Agentic-Work-Suite-for-Businesses)
- Akiflow: [pricing](https://akiflow.com/pricing), [home](https://akiflow.com/), [download](https://akiflow.com/download)
- Reclaim: [pricing](https://reclaim.ai/pricing), [home](https://reclaim.ai/)
- Morgen: [pricing](https://www.morgen.so/pricing), [home](https://www.morgen.so/)
- Amie: [pricing](https://amie.so/pricing), [MCP](https://amie.so/mcp)
- Structured: [home](https://structured.app/), [help: Pro](https://help.structured.app/en/articles/324674), [help: prices](https://help.structured.app/en/articles/331330)
- [Tiimo pricing](https://www.tiimoapp.com/pricing), [Routine pricing](https://routine.co/pricing), [Superlist pricing](https://www.superlist.com/pricing), [Superlist MCP](https://www.superlist.com/mcp)
- Notion: [pricing](https://www.notion.com/pricing), [MCP docs](https://developers.notion.com/docs/mcp), [release notes 2026-07-16](https://www.notion.com/releases/2026-07-16)
- [Saner.ai pricing](https://www.saner.ai/pricing)
- Rize: [pricing](https://www.rize.io/pricing), [MCP changelog](https://rize.io/changelog/rize-mcp)
- [ActivityWatch](https://activitywatch.net/), [Clockwise shutdown notice](https://www.getclockwise.com/)
- [Apple App Store RSS reviews](https://itunes.apple.com/us/rss/customerreviews/id=1580440623/sortby=mostrecent/json) (same pattern for ids 1475755747, 1621279084, 572688855, 626144601, 1499198946, 1480220328, 1604574131, 1548277133)

**B: reputable press and app intelligence**
- [TechCrunch: Dropbox acquires Reclaim (2024-08-22)](https://techcrunch.com/2024/08/22/dropbox-acquires-index-ventures-backed-ai-scheduling-tool-reclaim-ai), [GeekWire](https://geekwire.com/2024/dropbox-acquires-reclaim-a-calendar-app-that-uses-ai-scheduling-to-boost-productivity/)
- [TechCrunch: Todoist Ramble (2026-01-21)](https://techcrunch.com/2026/01/21/todoists-app-now-lets-you-add-tasks-to-your-to-do-list-by-speaking-to-its-ai/)
- [TechRadar: 2025 App Store Awards](https://www.techradar.com/computing/websites-apps/apple-reveals-the-17-must-download-apps-of-2025-the-app-store-award-winners-are-here)
- [YC launch: Vibe Kanban](https://www.ycombinator.com/launches/Nwy-vibe-kanban-10x-your-claude-code-usage)

**C: company and vendor blogs**
- [Morgen: Sunsama pricing 2026](https://www.morgen.so/blog-posts/sunsama-pricing) (competitor source), [Tiimo award post](https://www.tiimoapp.com/resource-hub/tiimo-winner-2025-app-store-awards), [Rize MCP blog](https://rize.io/blog/rize-mcp-chat-with-your-time-data), [borncity: Things 3.23](https://borncity.com/news/things-3-23-cultured-code-ueberarbeitet-wiederholungs-system/), [hep.gg time tracking](https://docs.hep.gg/docs/ai/time), [Grafana Claude Code Metrics](https://grafana.com/grafana/dashboards/24993)

**D: forums, reviews and directories**
- App Store reviews (above), [HN 47641840](https://news.ycombinator.com/item?id=47641840), [HN 40168024](https://news.ycombinator.com/item?id=40168024), [Akiflow MCP coverage (kingy.ai)](https://kingy.ai/news/akiflow-mcp-guide/), [TickTick community MCPs (mcp.so)](https://mcp.so/server/ticktick-mcp), [Structured review (habitbox)](https://habitbox.app/blog/structured-app-review), [Amie price aggregator (toolradar)](https://toolradar.com/tools/amie/pricing), [ADHD planner essay](https://adhdwithouttheguilt.substack.com/p/why-every-planner-dies-after-2-weeks)
