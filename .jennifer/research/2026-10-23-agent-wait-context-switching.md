# Agent waits, context loss and re-entry: evidence and interventions

Date: 2026-10-23 · Scope: interruption science, productive waiting, 2025-26 agent-wait data, interventions. Excludes items already known (METR 2025, BCG/HBR, Berkeley Haas, Osmani, Keiffenheim, Willison, notifiers, Leroy & Glomb, Rubinstein).

## Bottom line

- **Agent waits run far past the point where attention holds.** The usual limit for keeping attention on a task is about 10 s (Nielsen, citing Miller 1968). Median Claude Code turns are about 45 s, and the 99.9th percentile is over 40 min. Leaving during the wait is the normal response.
- **The cost comes from not returning, more than from switching.** In Iqbal & Horvitz's field study, an alert-driven switch took about 10 min, and people needed another 10-15 min to get back to focused work. 27% of suspensions took more than 2 h to resume, and users blamed lost context.
- **In real use, the human is the slow side.** In multi-turn Copilot agent sessions, a median 80.1% of wall-clock time is the user idle between turns. LLM time is 13.7%.
- **Cues work, and they need to be visible and specific.** Resumption cues doubled task success for interrupted programmers (DeLine/Parnin). Windows still visible on screen were returned to faster (Iqbal & Horvitz). A subtle cue did no better than no cue (Trafton 2005, snippet).
- **Waits can be used, but timing matters.** The best moment to offer a small task is right after the user hands off (Cai, wait-learning). No study tests this for agent waits. That is an open gap.

## Science table

| Finding | Number | Grade | Source |
|---|---|---|---|
| Attention limit for system delays | ~10 s; past that, show a percent-done indicator | A- (NN/g, citing Miller 1968 and Card 1991) | Nielsen |
| A warning before an interruption lets people prepare and resume faster | 8 s warning vs. none: warned group prepared more and resumed faster | A | Trafton et al. 2003, IJHCS |
| Goals decay in memory; a cue encoded at suspension helps retrieval | model (qualitative) | A | Altmann & Trafton 2002 |
| Blatant "last action" cue beats a subtle cue; subtle cue no better than none | direction only | A (snippet) | Trafton 2005 HFES |
| Field: alert switch, then return | ~10 min on the diversion, plus 10-15 min more; 27% of suspensions >2 h | A | Iqbal & Horvitz CHI 2007 (27 users, 2 weeks) |
| Visible suspended windows get resumed faster | <25% visible vs. >75% visible: significant (p<0.005, email) | A | Iqbal & Horvitz 2007 |
| Interruptions at task breakpoints cost less | lower workload at subtask boundaries | A (snippet) | Iqbal & Bailey CHI 2006/2008 |
| Interrupted workers finish faster but with more stress and frustration | direction only | A (snippet) | Mark, Gudith & Klocke CHI 2008 |
| Screen attention before switching | avg 47 s, median 40 s | B (snippet) | Mark, UC Newsroom / Steelcase |
| Programmers resuming work rarely edit right away | only 10% of sessions start coding within 1 min; heavy note-taking | A (snippet) | Parnin & Rugaber (10k sessions, 85 programmers) |
| Automated resumption cues | 2x success rate vs. note-taking alone | A | DeLine & Parnin (MSR) |
| Wait-learning | 57 words learned in 2 weeks (n=20); most receptive right after sending | A | Cai et al. CHI 2015 |

## Evidence on waiting for AI agents

- **Agent turn lengths (Anthropic, A, vendor-official).** Median Claude Code turn about 45 s. The 99.9th percentile went from under 25 min to over 45 min (Oct 2025 to Jan 2026). Experienced users switch on auto-approve more often (about 20% of sessions, rising to over 40%) and also interrupt more (5% to 9% of turns). Claude stops to ask for clarification more often than humans interrupt it, and Anthropic notes it "may not be stopping at the right moments."
- **Copilot production traces (Liu et al., Microsoft, Aug 2026, A-/preprint).** 13M sessions. Median session: 3 user turns, 4.2 min. Mean session: 62.6 min. P90 session is over 3 h. Idle time is bimodal: seconds within a turn, minutes between turns. A predictor captures 86-90% of idle time.
- **TraceLab (UW, 2026, A-/preprint).** 4,265 Claude Code and Codex sessions from 43 developers. Tool latency is heavy-tailed. About 4% of tool calls run over 1 min, and those account for 85% of tool time (via secondary summary, unverified).
- **Controlled study (Chen, Talwalkar, Brennan, Neubig, arXiv 2507.08149, A-).** OpenHands vs. Copilot, n=20. Hands-on effort fell from 25.1 to 12.5 min, but total time with the agent was 27.9 min. Flow showed no significant difference. Participants said things like "just kind of sitting there." The study did not measure multitasking.
- **Latency is not simply bad (Tan et al., CHI 2026, A, via secondary).** Delays of 2/9/20 s in non-coding LLM tasks: the fastest condition did not improve behavior or workload.
- **Typical durations (C).** Third parties describe Codex cloud tasks as about 1-30 min. I could not open OpenAI's page (403).
- **Practitioners (C/D).** Advice includes: plan first, then auto-accept and leave (Cherny quote, unverified); pick a lighter task for the wait instead of new feature work; cap parallel agents (about 5 on HN; "brain fried" after 30 min on Blind).

## Interventions

| Intervention | Mechanism | Evidence grade | Who does it today |
|---|---|---|---|
| Suspension cue: one line on "where I was and what's next," written before delegating | Encodes the goal at suspension (memory-for-goals) | A (mechanism); none for agents | Practitioner notes, CLAUDE.md/AGENTS.md (C) |
| Recap on return | Retrieval cue at resumption | A (DeLine/Parnin cue 2x) | Claude Code session recap: after ≥3 min unfocused and ≥3 turns, ≤400 chars, `/recap` |
| Keep the suspended task visible | Visibility pulls people back out of diversion chains | A (Iqbal & Horvitz) | Notch/menubar notifiers (C) |
| Advance warning ("done in about N min") | Interruption lag gives time to prepare | A (Trafton 2003) | Rare; progress bars only |
| Notify at your breakpoints, not the agent's | Lower interruption cost at subtask boundaries | A (lab) | None found |
| Pre-chosen micro-task for the wait | Wait-learning; avoids heavy new context | A (non-coding) / C | Cai prototypes; HN advice |
| Plan or spec first, then let it run | Fewer mid-run clarifications | C | Claude Code plan mode, Cursor planner |
| Async PR or review queue | Batch review at a time you choose | C (official docs) | Copilot coding agent (draft PR, then review request, snippet); Cursor Cloud Agents (VM, PR, snippet); Codex cloud |
| Cap concurrent agents | Limits how many goals compete in memory | D | Forum heuristics |

## Implications for the product (interpretation)

1. **Capture a suspension cue at "working" start.** Offer a one-tap "next I'll check…" field. Hooks never touch prompts, so this is the user's own text. It maps directly onto memory-for-goals.
2. **Treat the 10 s / 45 s / minutes split as states.** Under about 10 s, do nothing. For minute-scale turns, suggest a small pre-chosen task. Only for long runs, open a deliberate switch slot and give an ETA warning.
3. **Track "lost returns."** Sessions stuck in waiting-on-you for 2 h or more match Iqbal's 27% tail. That makes a strong metric and nudge target.
4. **Make waiting sessions persistently visible,** like a window that isn't covered, rather than a single toast.
5. **Batch the "done" alerts and deliver them at the user's breakpoints,** for example when a calendar block or focus task ends.
6. **Do not compete with Claude's recap.** Point to it, and add the user's own cue next to it.

## Gaps

- No study measures what developers do during agent waits or how much it costs to come back. Copilot and TraceLab measure machine idle time, not human behavior.
- No test of wait-learning or micro-tasks during coding-agent waits.
- No evidence on breakpoint-timed agent notifications.
- Could not verify: the Google build-latency IEEE paper, the Codex duration figure from OpenAI itself, the Cherny quote, and the TraceLab 4%/85% figure.

## Sources

- [A] Nielsen, Response times: https://www.nngroup.com/articles/response-times-3-important-limits/
- [A] Trafton et al. 2003: https://interruptions.net/literature/Trafton-IJHCS03.pdf
- [A] Altmann & Trafton 2002: https://www.interruptions.net/literature/Altmann-CogSci02.pdf
- [A, snippet] Trafton 2005: https://www.interruptions.net/literature/Trafton-HFES05.pdf
- [A] Iqbal & Horvitz 2007: https://www.erichorvitz.com/CHI_2007_Iqbal_Horvitz.pdf
- [A, snippet] Iqbal & Bailey 2006: https://interruptions.net/literature/Iqbal-CHI06-p741-iqbal.pdf ; Iqbal 2008: https://www.interruptions.net/literature/Iqbal-CHI08.pdf
- [A, snippet] Mark et al. 2008: https://www.interruptions.net/literature/Mark-CHI08.pdf
- [B, snippet] Mark, 47 s: https://www.universityofcalifornia.edu/news/how-sharpen-your-attention-and-meet-your-goals-2024
- [A, snippet] Parnin & Rugaber: https://sites.cc.gatech.edu/reverse/repository/resumptionstrategies.pdf
- [A] DeLine & Parnin, Evaluating cues: https://www.microsoft.com/en-us/research/publication/evaluating-cues-for-resuming-interrupted-programming-tasks/
- [A] Cai et al. 2015: https://sls.csail.mit.edu/publications/2015/Cai_CHI-2015.pdf
- [A, snippet] WaitSuite: https://dspace.mit.edu/handle/1721.1/112331
- [A] Anthropic, Measuring agent autonomy: https://www.anthropic.com/research/measuring-agent-autonomy
- [A-] Liu et al., Copilot traces: https://www.microsoft.com/en-us/research/wp-content/uploads/2026/08/ghcp_traces-6.pdf (also https://arxiv.org/html/2608.00101v1)
- [A-] TraceLab: https://arxiv.org/abs/2606.30560
- [A-] Chen et al.: https://arxiv.org/html/2507.08149v2
- [C] Viborc, latency/flow review (source for Tan CHI 2026, TraceLab 4%/85%): https://viborc.com/can-faster-ai-inference-give-developers-their-flow-back/
- [A] Claude Code interactive mode, Session recap: https://code.claude.com/docs/en/interactive-mode
- [A, snippet] Copilot coding agent: https://docs.github.com/en/copilot/using-github-copilot/coding-agent/using-copilot-to-work-on-an-issue
- [A, snippet] Cursor background agents: https://cursor.com/help/ai-features/background-agents
- [C, snippet] Codex durations: https://codex.danielvaughan.com/2026/04/18/codex-cli-vs-codex-cloud-when-to-use-each/
- [C, snippet] Plan-mode practice: https://www.shiplight.ai/api/blog/claude-code-plan-mode/raw
- [D, snippet] HN flow thread: https://hn.svelte.dev/item/47797632 ; Blind: https://www.teamblind.com/post/be-honest-are-you-guys-actually-constantly-spawning-3-agent-workflows-at-once-throughout-the-entire-work-day-irttlbkx
