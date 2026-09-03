# AI productivity illusion: evidence for and against the founder's thesis

_Retrieved 2026-10-23 · Staleness horizon: 90 days_

Grades: **A** peer-reviewed / RCT / meta-analysis · **B** reputable survey, press, single study or strong preprint · **C** vendor/company blog · **D** forum/anecdote. "(secondary)" = number seen only in coverage, not the primary text.

Thesis under test: _"AI tools greatly reduce a human's ability to focus on one task; AI agents make people FEEL more productive when in reality they did nothing but prompt."_

## Bottom line

**Partially supported. Reframe before building on it.**

- **Strongly supported: perception is unreliable.** People overestimate AI's benefit to themselves. METR 2025 found a ~39-point gap between belief and measurement. Fernandes et al. replicated overestimation of own performance with AI (N=246, N=452). Self-reports cannot be the product's truth source.
- **Strongly supported: output inflates faster than finished work.** Telemetry from Faros, Harvard/Jellyfish and DORA shows more code and PRs, flat completed work at org level, longer review and more instability.
- **Supported: skill and engagement erode when work is _delegated_ rather than _understood_.** Anthropic's RCT (−17 pts quiz), Bastani PNAS (−17% exam), the Lancet deskilling study and Lee CHI 2025 all point the same way.
- **Supported but thinner: focus and fatigue costs.** BCG "brain fry" (14%, productivity falls at a 4th concurrent tool), Berkeley Haas (work intensification) and practitioner reports (Willison, Yegge, Ronacher). There is no controlled study yet of parallel-agent supervision and attention.
- **Contradicted as stated: "did nothing but prompt."** RCTs and field experiments show real gains on suitable tasks:
  - Copilot RCT: 55.8% faster.
  - Field experiments across 3 firms: +26% completed tasks.
  - Customer support: +15%.
  - BCG consultants: +12% tasks and higher quality inside the frontier.
  - Microsoft Claude Code / Copilot CLI rollout: +24% merged PRs.

  METR's own 2026 data now likely shows speedup, though it is unreliable.
- **Defensible thesis:** _"AI gains are real but uneven. People can't tell which side of the frontier they're on, gains are measured in activity not outcomes, and delegation without understanding costs skill and attention. The platform should show intention vs. verified outcome, and protect focus and understanding."_

## 1. Perceived vs. actual productivity

| Claim | Source | Key number | Grade | Caveats |
|---|---|---|---|---|
| Experienced OSS devs were slower with AI but believed they were faster | METR RCT, Jul 2025 (known) | +19% time (CI +2% to +39%); devs believed −20% | A | n=16, early-2025 tools; METR now labels it "historical" |
| Follow-up likely shows speedup, but METR calls the signal unreliable | METR, 2026-02-24, https://metr.org/blog/2026-02-24-uplift-update/ | Returning devs −18% time (CI −38% to +9%); new devs −4% (CI −15% to +9%) | B | Selection bias: devs refused to work without AI; 30-50% withheld tasks; concurrent agents broke time measurement |
| Self-reported value uplift is large | METR survey, 2026-05-11, https://metr.org/blog/2026-05-11-ai-usage-survey/ | Median value 1.4x-2x; speed ~3x; N=349 | B | ~2% response rate; METR says self-reports "not necessarily grounded in reality"; METR staff reported the lowest gains |
| AI users overestimate their own performance; higher AI literacy brings more overconfidence | Fernandes et al., Computers in Human Behavior 2025, doi 10.1016/j.chb.2025.108779 | +3 pts actual vs +4 pts overestimate on LSAT; Dunning-Kruger effect disappears | A | Lab reasoning task, not coding |
| Individual output up, org delivery flat | Faros AI "AI Productivity Paradox" 2025, https://faros.ai/research | 10k devs: +21% tasks, +98% PRs merged, +91% review time, +154% PR size, no DORA gain | C | Vendor telemetry; primary PDF not read (secondary) |
| Same pattern at larger scale | Faros AI Engineering Report 2026 | 22k devs: epics/dev +66%, bugs/dev +54%, incidents ×3 | C | Secondary only; unverified |
| Agents raise code volume, not finished work; review becomes the bottleneck | Chen & Stratton (Harvard) working paper "AI in the Firm: Bottlenecks in Software Production", Jellyfish data, 718 firms, v. 2026-08-04 (via Ars Technica 2026-10-09) | LOC +30%, PRs +23%, issues resolved n.s., review/merge time +49% | B | Working paper, observational DiD; numbers secondary |
| AI improves throughput but still associates with instability | DORA 2025, https://cloud.google.com/blog/products/ai-machine-learning/announcing-the-2025-dora-report | ~5,000 respondents; 90% use AI; >80% feel more productive; 30% little/no trust | B | Survey, no effect sizes published on the page; the "−7.2% stability" figure is 2024 data |
| Workload rises | Upwork Research Institute, 2024-07-23, https://investors.upwork.com/news-releases/news-release-details/upwork-study-finds-employee-workloads-rising-despite-increased-c | 77% of AI-using employees say AI added to workload; 47% don't know how to reach expected gains | B | Vendor-commissioned survey |
| Google internal RCT: faster | Paradis et al., ICSE-SEIP 2025, https://arxiv.org/abs/2410.12944 | ~21% faster (wide CI); n=96 | B | Single enterprise task, internal tools |
| Microsoft CLI-agent rollout | Murphy-Hill, Butler, Savelieva, 2026-07-01, https://arxiv.org/abs/2607.01418 | +24% merged PRs vs counterfactual over 4 months | B | Preprint; merged PRs are a proxy, and the authors say PRs are not value |

## 2. Cognitive costs

| Claim | Source | Key number | Grade | Caveats |
|---|---|---|---|---|
| AI help while learning a new library hurts mastery without a significant speed gain | Anthropic, 2026-01-29, https://www.anthropic.com/research/AI-assistance-coding-skills (arXiv 2601.20245) | Quiz 50% vs 67% (d=0.74, p=0.01); time ~23 vs 25 min (n.s.); n=52 | A- (RCT, preprint) | Small, 1-hour task, chat UI, mostly juniors |
| How AI is used matters more than whether | same | Conceptual-only 65%; code + explanation 68%; generate-then-ask 86%; pure delegation 39%; iterative AI debugging 24% | B | Subgroups n=2 to 7; observational within the RCT |
| Unguarded AI harms learning; a guarded tutor doesn't | Bastani et al., PNAS 2025, 122(26) | Practice +48% (Base) / +127% (Tutor); exam −17% for Base, ~0 for Tutor | A | ~1,000 high-school math students, one country |
| Confidence in AI is linked to less critical thinking | Lee et al., CHI 2025, doi 10.1145/3706598.3713778 | N=319, 936 examples; self-confidence ↑ critical thinking, AI-confidence ↓ | A- | Self-report, correlational |
| Critical thinking falls with frequent AI use, mediated by offloading | Gerlich, Societies 2025, 15(6) | N=666; negative correlation | B | Correlational |
| "Cognitive debt" (EEG) | Kosmyna et al., arXiv 2506.08872, Jun 2025 | Lowest connectivity in the LLM group; 54 participants, 18 in session 4 | B- (preprint) | Not peer-reviewed; formal critique arXiv 2601.00856 says connectivity ≠ engagement, and the quoting result is weak. Don't headline it. |
| Deskilling after routine AI use | Budzyń et al., Lancet Gastro Hepatol 2025 | Unassisted adenoma detection 28.4% → 22.4% after AI exposure (OR 0.69) | A- | Observational before/after; medicine, not coding |
| Automation complacency rises with multitask load; training doesn't fix it | Parasuraman & Manzey, Human Factors 2010, 52(3), doi 10.1177/0018720810376055 | Review (no single number) | A | Pre-LLM; mechanism transfers directly to parallel agents |
| People don't engage with AI explanations, even under cognitive forcing | Gajos & Mamykina, IUI 2022, https://arxiv.org/abs/2202.05402 | Engagement appears when AI gives information without a recommendation | A- | Nutrition task |
| Workslop shifts effort to recipients | Niederhoffer, Hancock et al., HBR 2025-09-22; BetterUp/Stanford infographic https://betterup.com/workslop-infographic | N=1,150; 40% received workslop last month; 15.4% of work received; ~1h56m per incident; $186/mo (vendor extrapolation) | B | Vendor co-run survey; numbers from infographic, HBR text paywalled |

## 3. Attention and multitasking with agents

| Claim | Source | Key number | Grade | Caveats |
|---|---|---|---|---|
| Supervising AI is the fatigue trigger; productivity falls at a 4th tool | Bedard, Kropp et al. (BCG), HBR 2026-03-05 "When Using AI Leads to 'Brain Fry'"; numbers via Built In 2026-06-10 | ~1,500 workers; 14% brain fry; +11% minor errors, +39% major errors, +33% decision fatigue; 34% want to quit; productivity drops at 4th agent/tool | B | Numbers secondary (paywall); cross-sectional |
| Managers answering AI questions lowers fatigue; offloading tedium lowers burnout | same | Fatigue −15% when managers answer; burnout −15% when AI replaces tedious work | B | same |
| AI intensifies work: scope creep, work leaking into breaks, parallel threads | Ye & Ranganathan (Berkeley Haas), 2026-02-18, https://newsroom.haas.berkeley.edu/ai-promised-to-free-up-workers-time-uc-berkeley-haas-researchers-found-the-opposite/ | 8-month ethnography, ~200-person firm | B | Single site, qualitative |
| Concurrent agents make time measurement itself unreliable | METR 2026-02-24 (above) | Qualitative | B | Directly relevant to skkil's capture design |
| Review speed is the real limit; can land one significant change at a time | Simon Willison, 2025-10-05, https://simonwillison.net/2025/Oct/5/parallel-coding-agents/ | n/a | D (anecdote) | Expert practitioner |
| Agents are energy vampires; cap agent work at ~3-4 h/day | Steve Yegge "The AI Vampire", Feb 2026 (via https://simonwillison.net/2026/feb/15/the-ai-vampire) | 3-4 h (sources differ) | D | Opinion |
| "Agent coding addiction", sleep loss, degraded PR/issue quality | Armin Ronacher, 2026-01-18, https://lucumr.pocoo.org/2026/1/18/agent-psychosis/ | n/a | D | Self-report |
| Comprehension debt: code volume outpaces human understanding | Addy Osmani, Mar 2026, https://addyosmani.com/blog/comprehension-debt/ | n/a | D | Opinion, cites the Anthropic RCT |
| Slot-machine / variable-reward framing | Axios 2026-04-04 (Dettmers quote); agentpatterns.ai | n/a | D | Analogy; no direct dopamine measurement in agent users |
| Screen attention fragmentation baseline | Gloria Mark (field studies) | 47 s average per screen (2016); ~25 min to resume interrupted project (2005) | A-/B | Pre-AI; the "23 min" figure is mis-cited |

## 4. Counter-evidence (real gains)

| Claim | Source | Key number | Grade | Caveats |
|---|---|---|---|---|
| Copilot speeds a scoped task | Peng et al. 2023, https://arxiv.org/abs/2302.06590 | 55.8% faster (95% CI 21-89%) | A- | Single greenfield JS task; GitHub authors |
| Field experiments at Microsoft, Accenture, Fortune-100 firm | Cui, Demirer, Jaffe, Musolff, Peng, Salz, Management Science (doi 10.1287/mnsc.2025.00535), https://papers.ssrn.com/abstract=4945566 | +26.08% completed tasks (SE 10.3%); n=4,867; juniors gain more | A | Completions-era tool; "tasks" = PRs/commits/builds |
| Customer support gains, largest for novices | Brynjolfsson, Li, Raymond, QJE 2025, doi 10.1093/qje/qjae044 | +15% issues/hr (QJE); 14% avg, 34% novices (2023 WP) | A | Experts gained little |
| Jagged frontier: big gains inside, harm outside | Dell'Acqua et al., Organization Science 2026, doi 10.1287/orsc.2025.21838 | 758 consultants; inside: +12.2% tasks, 25.1% faster, >40% quality (secondary); outside: worse (BCG says 23% worse; commonly cited 19 pp less correct, unverified) | A | Primary text not read |
| Google RCT; Microsoft rollout | see §1 | ~21% faster; +24% merged PRs | B | |

**Fair reading:** gains are real for well-scoped tasks, novices, and inside-frontier work. Losses show up for experts in familiar codebases, outside-frontier tasks, learning, and downstream (review, stability). The founder's "nothing but prompt" is false on average. It is true for the subset of sessions where output isn't accepted or understood, which is exactly what skkil can detect.

## 5. Interventions with evidence

| Intervention | Evidence | Key number | Grade |
|---|---|---|---|
| **Attempt / commit first, then see AI** | Fogliato et al., FAccT 2022, https://arxiv.org/abs/2205.09696: provisional answer before AI reduced blind agreement, no time cost; 65% more likely to revise (secondary). Generation effect meta-analysis (Bertsch et al. 2007, Mem Cogn 35:201) | d=0.40 generation effect; no added time | A |
| **Ask for explanation / conceptual help, not delegation** | Anthropic RCT subgroups (65-86% vs 24-39%); Bastani GPT Tutor (no exam harm) | see §2 | A-/B |
| **Cognitive forcing functions** (wait, commit, on-demand reveal) | Buçinca, Malaya, Gajos, CSCW 2021, https://arxiv.org/abs/2102.09692: reduced overreliance vs XAI baselines; lower satisfaction; helps high need-for-cognition users most | Effect sizes not retrieved | A |
| **Step-by-step "lead and reveal" before showing code** | Kazemitabaar et al. 2024, https://arxiv.org/abs/2410.08922 (N=82, N=42): guided step-by-step was the most effective engagement technique | No effect size retrieved | B |
| **Show information, not verdicts** | Gajos & Mamykina 2022 | Qualitative | A- |
| **Plan with if-then intentions** (plan-before-delegate analogue) | Gollwitzer & Sheeran 2006 meta (94 tests) | d=0.65 on goal attainment | A (not AI-specific) |
| **Batch notifications ~3×/day** | Fitz, Kushlev et al., CHB 2019, RCT N=237 | Less stress, more attention vs hourly or none | A (phones, not agents) |
| **Limit concurrency (≤3 agents/tools)** | BCG brain fry (productivity declines at 4th) | Threshold, secondary | B |
| **Cap agent-intensive hours; budget reflection time** | BCG recommendations; Yegge | n/a | B/D |
| **Measure outcomes, not usage/tokens** | BCG; DX; DORA | n/a | B/C |

No direct evidence found for: scheduled review blocks for agent output, acceptance-criteria-before-delegation, or concurrency limits in a controlled setting. These are plausible but untested.

## 6. Measurement: real output vs. activity

- **Self-report is invalid as a sole signal.** It has a ~40-point gap (METR), and overconfidence grows with AI literacy (Fernandes).
- **Activity metrics inflate under AI:** LOC, PR count and session count all rise without finished work rising (Chen & Stratton; Faros).
- **Better individual signals,** combining the cited sources:
  1. Accepted / merged / shipped units tied to a planned intention.
  2. Rework: follow-up fixes and reverts within N days. A study of follow-up fixes on agent PRs exists (arXiv 2609.26847, not read).
  3. Review depth and time-to-review, both for your own review of agent output and for others' review of yours.
  4. Wait vs. engaged time per agent session, and concurrency.
  5. Planned-vs-actual focus blocks.
  6. Periodic unaided checks of understanding: can you explain or modify it without AI? (Anthropic quiz design).
- **Frameworks:**
  - SPACE (Forsgren et al. 2021) supports multi-dimensional measurement including satisfaction and flow.
  - DX Core 4 (speed, effectiveness, quality, impact) explicitly says "never measure individuals" for evaluation. A personal tool should therefore be private, self-directed and reflective, not a scorecard.
  - DORA covers stability/rework as the counterweight to throughput.

## Interventions a product could build, ranked by evidence

1. **Verified-outcome ledger:** link each agent session to an intention and mark it accepted/merged/discarded/reworked. Weekly review shows "felt productive vs. shipped." _(A/B: perception gap plus activity inflation.)_
2. **Commit-first prompt:** before delegating, a 1-line "my approach / expected result," compared after. _(A: Fogliato, generation effect, cognitive forcing.)_
3. **Understand-before-accept nudge:** after a large agent diff, prompt "explain what changed / ask the agent why" before marking it done. _(A-/B: Anthropic subgroups, Bastani, Kazemitabaar.)_
4. **Concurrency and supervision meter:** show live agent count and wait vs. engaged time, and warn above 3. _(B: BCG; METR concurrency note.)_
5. **Batched agent notifications:** deliver "needs you" alerts at scheduled check-ins instead of interrupting deep blocks. _(A by analogy: Fitz 2019.)_
6. **If-then planning for delegation:** "If the agent finishes X, then I review in block Y." _(A by analogy: implementation intentions.)_
7. **Daily agent-hours budget plus a reflection slot.** _(B/D.)_
8. **Periodic unaided skill check / "no-AI rep" blocks** for skills the user wants to keep. _(A-: Anthropic, Bastani, Lancet deskilling.)_

## Gaps (unverified or missing)

- **Multitudes out-of-hours commits:** no primary source found.
- **Faros 2026 figures** (66% / 54% / ×3) and the Faros 2025 numbers were seen in secondary coverage only.
- **Chen & Stratton exact figures** (+49% review time, +30% LOC): not read in the paper itself.
- **Dell'Acqua:** the "19 pp less likely correct" outside-frontier figure is unverified (BCG says "23% worse"); primary text not read.
- **BCG brain fry figures** come from Built In, not HBR, and the denominator for 14% is unclear.
- **Workslop numbers** come from BetterUp's infographic, not the HBR text.
- **Buçinca and Kazemitabaar effect sizes:** not retrieved.
- **Missing studies:** no controlled study of parallel-agent supervision and attention; no RCT of UI nudges on agentic coding (as opposed to chat or decision tasks).
- **Not reviewed:** arXiv 2609.26847 (follow-up fixes on agent PRs) and 2607.21832 (agentic PRs) may give rework baselines.
- **Kosmyna:** no peer-reviewed version or author response found.
- **Not checked:** Microsoft New Future of Work 2025 report; Google internal 2026 studies.

## Sources by grade

**A:**
- METR RCT 2025
- Cui et al., Management Science
- Brynjolfsson et al., QJE 2025
- Dell'Acqua et al., Org Sci 2026
- Bastani et al., PNAS 2025
- Lee et al., CHI 2025
- Fernandes et al., CHB 2025
- Budzyń et al., Lancet GH 2025
- Parasuraman & Manzey 2010
- Buçinca et al., CSCW 2021
- Gajos & Mamykina, IUI 2022
- Fogliato et al., FAccT 2022
- Bertsch et al. 2007
- Gollwitzer & Sheeran 2006
- Fitz et al., CHB 2019
- Anthropic skill-formation RCT (preprint, A-)
- Peng et al. 2023 (A-)

**B:**
- METR 2026-02-24 update; METR 2026-05-11 survey
- DORA 2025
- Paradis et al. (Google)
- Murphy-Hill et al. (Microsoft)
- Chen & Stratton (Harvard/Jellyfish)
- BCG/HBR brain fry
- Berkeley Haas
- Upwork 2024
- Workslop (HBR/BetterUp)
- Gerlich 2025
- Kosmyna et al. (preprint, B-)
- Kazemitabaar et al. 2024

**C:**
- Faros AI 2025/2026
- DX Core 4 (getdx.com)

**D:**
- Willison, Yegge, Ronacher, Osmani
- Axios slot-machine piece
- agentpatterns.ai
