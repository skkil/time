# AI agent sessions and human attention · Research scan (evidence)

_Retrieved 2026-10-18 by 3 parallel research passes · Staleness horizon: 60 days_

Grades: A official/peer-reviewed · B reputable press · C company/vendor blog · D forums. "snippet" = seen in search results only.

## A. Agent session tools

| Product | Cross-tool? | Pricing | Attention features |
|---|---|---|---|
| Conductor | Yes | Free; Pro $50/mo | Dashboard of agent state |
| Claude Squad | Yes | OSS (AGPL) | Tab between sessions |
| Vibe Kanban | Yes | OSS; company shut down Apr 2026 | Board columns |
| Emdash (YC W26) | Yes, 34 CLIs | OSS | Not found |
| Sculptor (Imbue) | Claude Code, Codex | Free beta (snippet) | Conflict suggestions |
| Terragon | Yes | Shut down early 2026 | n/a |
| Claude Code Desktop / Projects | Claude only | Pro/Max/Team/Ent | Status filters; Waiting on you / Ready for review; OS + phone notifications |
| Codex app | OpenAI only | Bundled in ChatGPT plans | Threads, review queue |
| Cursor 3 Agents Window | Cursor | Plans $8-200 (verify) | Agent grid, sidebar |
| GitHub mission control / Agent HQ | Yes | Copilot Pro $10, Pro+ $39, Max $100 | Live logs, steering; advises batched review |
| Warp | Yes | Not fetched | Inbox with Complete/Request/Error, unread filters |
| Jules, Devin, Amp, OpenCode | Own agent | Various | Not found |
| AgentNotch, AgentBell, Pulser, ClaudeCodeNotify | Mostly | AgentNotch $9.99 one-time; Pulser free; AgentBell free tier | Persistent "waiting" state; AgentBell avg task time; Pulser idle-time estimate (blog) |

Finding: every tool tracks agent state; none tracks the human's time or attention across sessions.

Complaint themes: context-switching fatigue (~15), review debt (~18 comments in one HN thread; Harvard/Jellyfish 718 firms: review 49% longer), "which session needs me" (8 GitHub issues incl. Claude Code #2654, #100228), notification noise (2), slot-machine waiting (~8).

## B. Integration surface

| Tool | Integration | Waiting-for-human event | Content-free possible |
|---|---|---|---|
| Claude Code | Hooks (~33 events), OTel, statusline, OSC 7501 | Notification (idle_prompt, permission_prompt, agent_needs_input), PermissionRequest | Yes |
| Codex CLI/app | notify, hooks (12 events), OTel | PermissionRequest | Yes (drop notify message fields) |
| Cursor | ~/.cursor/hooks.json; Cloud Agents API beta | Not found | Yes |
| Gemini CLI | Hooks, OTel | Notification | Yes; OTel logPrompts on by default |
| Copilot CLI | Hooks; REST API | permissionRequest, notification | Yes (drop toolArgs) |
| Windsurf/Devin | hooks.json | Not found | Yes |
| OpenCode | JS plugin events | permission.asked | Yes |
| Aider | --notifications-command | Done/waiting | Yes |
| Web chats | DOM observation only | Inferred | Yes if structure-only; brittle |

Standards: OSC 7501 (rev 0.4, 2026-10-10; idle/working/blocked/done/error); ACP (Zed; for hosting agents, not observing); OTel GenAI semconv (immature; per-vendor schemas).

## C. Demand evidence

| Claim | Figure | Date | Grade |
|---|---|---|---|
| Solo-founder share (Carta) | 23.7% (2019) → 36.3% (H1 2025) | 2025-12 | A/C snippet |
| Solo founders of Stripe Atlas C-corps | 63% (Q2 2026); median 6-mo revenue −23% YoY | 2026-05-28 | C |
| Daily AI use, pro developers | 50.6% | SO 2025 | A- |
| AI agent use | 31% use, 14.1% daily, 38% no plans | SO 2025 | A- |
| METR RCT | 19% slower; believed 20% faster | 2025-07-10 | A |
| METR follow-up | Likely speedup; time logs unreliable for concurrent multi-agent users | 2026-02-24 | A |
| "23 minutes" to resume | 23m15s; Gallup interview with Gloria Mark, not a paper | 2006-06-08 | B |
| BCG/HBR "brain fry" | 14% of AI users; productivity falls at 4+ tools; oversight +12% fatigue | 2026-03 | B |
| Berkeley Haas ethnography | Parallel agents → dissolved boundaries, fatigue | 2026-02-18 | B+ |
| Out-of-hours work | +19.6% out-of-hours commits (Multitudes) | 2026-03-30 | B |

Voices: 2-4 session ceiling (~6 sources incl. Willison, Osmani); losing track of sessions (~5); drifting while waiting (~3); addiction and sleep loss (~4); review debt (~3); ADHD framing (~3).

Counter-evidence: agent daily use is a minority; workflow fixes preferred (7 of ~13 HN comments); platforms improving session views; brain fry affects 14%.

WTP: Claude Pro $20, Max $100-200; ChatGPT Plus $20, Pro $100+; Rize $9.99-39.99.

## Gaps

Share of developers running 2+ concurrent sessions; traction for indie agent tools; whether hooks fire in desktop/web apps; Cursor waiting events; Carta/JetBrains/HBR primaries blocked; no direct WTP evidence for this product.

## Sources

**A / A-**
- https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/ · https://metr.org/blog/2026-02-24-uplift-update/
- https://survey.stackoverflow.co/2025/ai · https://arxiv.org/abs/2603.14225
- https://www.conductor.build/pricing · https://imbue.com/sculptor/ · https://github.com/terragon-labs/terragon-oss
- https://claude.com/blog/claude-code-desktop-redesign · https://code.claude.com/docs/en/desktop · https://code.claude.com/docs/en/claude-projects
- https://code.claude.com/docs/en/hooks · https://code.claude.com/docs/en/monitoring-usage · https://code.claude.com/docs/en/statusline
- https://learn.chatgpt.com/docs/hooks · https://learn.chatgpt.com/docs/config-file/config-advanced
- https://cursor.com/docs/agent/hooks · https://cursor.com/changelog/3-0 · https://cursor.com/pricing
- https://geminicli.com/docs/hooks/ · https://geminicli.com/docs/cli/telemetry/
- https://docs.github.com/en/copilot/reference/hooks-configuration · https://github.com/features/copilot/plans
- https://docs.devin.ai/desktop/cascade/hooks · https://opencode.ai/docs/plugins/ · https://aider.chat/docs/usage/notifications.html · https://ampcode.com/manual
- https://agentclientprotocol.com/protocol/overview · https://control-codes.page/proposals/osc-7501/ · https://opentelemetry.io/docs/specs/semconv/gen-ai/
- https://jules.google/docs/usage-limits/ · https://docs.warp.dev/agents/capabilities/agent-notifications/
- Carta (snippet): https://carta.com/data/solo-founders-report/

**B**
- https://venturebeat.com/orchestration/openai-launches-a-codex-desktop-app-for-macos-to-run-multiple-ai-coding
- https://fortune.com/2026/03/10/ai-brain-fry-workplace-productivity-bcg-study/
- https://newsroom.haas.berkeley.edu/ai-promised-to-free-up-workers-time-uc-berkeley-haas-researchers-found-the-opposite/
- https://news.gallup.com/businessjournal/23146/too-many-interruptions-work.aspx
- https://leaddev.com/ai/addictive-agentic-coding-has-developers-losing-sleep
- https://complexdiscovery.com/harvard-researchers-find-ai-coding-agents-shifted-the-bottleneck-to-code-review/

**C**
- https://stripe.com/blog/top-solo-founder-traits · https://github.blog/ai-and-ml/github-copilot/how-to-orchestrate-agents-using-mission-control/
- https://www.anthropic.com/research/impact-software-development · https://www.anthropic.com/research/economic-index-june-2026-report
- https://simonwillison.net/2026/Apr/2/lennys-podcast/ · https://addyosmani.com/blog/cognitive-parallel-agents/
- https://evakeiffenheim.substack.com/p/the-cognitive-costs-of-multi-clauding · https://heyvaldemar.com/merge-debt-2026-parallel-ai-agents/
- https://www.agentnotch.app/guides/claude-code-needs-input-notification · https://getpulser.app/blog/ai-coding-agent-idle-time-problem · https://agentbell.dev/blog/claude-code-notification-when-done
- https://www.augmentcode.com/tools/open-source-agent-orchestrators · https://claude.com/pricing · https://rize.io/pricing

**D**
- https://github.com/anthropics/claude-code/issues/2654 · https://github.com/anthropics/claude-code/issues/100228 · https://github.com/warpdotdev/warp/issues/14118
- https://news.ycombinator.com/item?id=48942000 · https://news.ycombinator.com/item?id=47202967 · https://news.ycombinator.com/item?id=47573483 · https://news.ycombinator.com/item?id=47079718
