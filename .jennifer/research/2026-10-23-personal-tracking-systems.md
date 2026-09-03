# Personal tracking and planning systems: how people run them and why they break

Date: 2026-10-23. Searches run: about 22. Fetches that worked: 12.

## Bottom line

- **The founder's setup is a normal one.** Popular systems stack the same layers: a year or quarter goal, a weekly plan, a daily plan or log, a habit grid, and a periodic review. Each layer has its own cadence, and people spread them across a notes tool, a task/calendar tool and a timer (S7, S8, S10, S14).
- **Lapsing is the normal outcome, not an edge case.** Epstein et al. (UbiComp '15) found four ways people lapse: **forgetting, upkeep, skipping, suspending**. 44% of physical-activity trackers and 45% of location trackers dropped their tool within 3 months. 53–78% had already used more than one tool (S1).
- **Guilt shows up a lot.** About half of 141 lapsed Fitbit users felt guilty about stopping, and nearly all of those wanted to come back. The researchers say apps wrongly assume people will track forever (S2).
- **The heavy custom builds (Notion Life OS) cost the most to maintain.** Practitioners call the upkeep a "second job" and estimate 1–2 h/week (S11, vendor source, grade C).
- **People who keep going for years** use **3–5 minutes a day, mostly yes/no fields, coarse ratings, and tolerate missed days**. The habit "felt ingrained" after about 100–150 days (S12, S13).

## Systems table

| System | What's tracked | Cadence | Typical tools | Who |
|---|---|---|---|---|
| PPV / Notion "Life OS" (August Bradley) | Pillars (life areas), Pipelines (goals → projects → actions), Vaults (knowledge) (S5 snippet) | Daily actions → yearly goals | Notion (paid course plus free YouTube builds) (S5 snippet) | Notion power users |
| Notion planner templates | Daily/weekly to-dos, time blocks, study hours, weekly review (S14) | Day / week | Notion, Gumroad templates priced around ₩5,000 or $2+ (S14 snippet) | Students, KR & global |
| Obsidian periodic notes | Daily → weekly → monthly → quarterly → yearly notes, each with its own template. Each level is a review of the level below (S7) | D/W/M/Q/Y | Periodic Notes plus Calendar plugins | PKM users |
| Steph Ango (Obsidian CEO) | Timestamped notes, compiled every few days, then a monthly review, then a yearly review using "40 questions". 1–7 ratings. One to-do list per week (S8) | Ad hoc / M / Y | Obsidian | Writers, PKM users |
| Bullet Journal | Daily log of tasks, events and notes. Monthly log. Future log. **Migration** (carry a task forward or drop it) (S9 snippet) | D / M / Y | Paper | Analog users |
| 12 Week Year | Weekly plan of tactics. **Execution score = tactics done / planned**, with 85% as the target. Weekly accountability (S10 snippet) | Week / 12 weeks | Spreadsheet, apps | Sales, coaching, solo founders |
| PARA / Building a Second Brain | Projects/Areas/Resources/Archive. The weekly review is "the habit that holds it together" (S15 snippet) | Week | Notion, Obsidian, Evernote | Knowledge workers |
| Annual review (Ali Abdaal) | Reflect, then Plan, then Execute. Goals by life area, with quarterly goals in derived templates (S16 snippet) | Year (+Q) | Notion | YouTube productivity audience |
| Sunsama | Morning: review yesterday, pull tasks, estimate, **overcommit warning**, timebox. Evening shutdown. Weekly objectives and review (S6) | D / W | Sunsama + calendar + integrations | Knowledge workers |
| Exist.io | Nightly mood rating plus custom tags. Correlated with passive data such as RescueTime, Todoist, sleep and activity (S17 snippet) | Day | Exist + integrations | Quantified-self hobbyists |
| Spreadsheet self-tracking | Sleep, exercise, work hours, stress 1–10, reading, social time (S12). Yes/no habits plus a 1–3 day score (S13) | Daily, logged next morning | Google Sheets | Long-term trackers |

**Gaps:** I found no primary data for Bearable, Gyroscope or Daylio. I found nothing directly on personal OKRs or Akiflow rituals beyond reviews (S18 snippet).

## Korea

- **갓생** ("god-life": a life of small, regular achievements) was named a 2022 trend keyword. It had 639,657 mentions in 2022, **58 times** the 2018 level. 오운완 ("today's workout done") had 830,000. The core action words are 공부 (study) and 운동 (exercise), tied to 시간 (time) (S19, from 서울연구원, the Seoul Research Institute).
- **Tracking as a challenge with proof.** MZ users do 미라클모닝 (early-morning routines), **스터디 인증** ("logging the time and content of each day's study") and weekly diary challenges. 90% of one diary challenge's participants were MZ (S20). Apps like 챌린저스 and 마이루틴 let users share routines (S21 snippet).
- **열품타** (a study-timer app): a stopwatch per subject that turns the timer into an auto-generated planner. It has an app blocker, live study groups, national rankings and D/W/M stats. It holds a 4.5★ rating from about 48,000 ratings on the KR App Store (S22). The core metric is **순공시간** (net study hours). Notion study planners also report 순공시간 by period plus weekly completion rates (S14 snippet).
- **Paper:** 10-minute-grid timetables, such as the 모트모트 텐미닛 플래너 (S23 snippet, advertorial). In the **3P 바인더** (강규형's binder system), the core is "record your time" (Drucker) and the weekly plan sheet is the key tool (S24 snippet). I did not confirm the 30-minute logging unit.
- **Pushback:** 국민건강보험공단 (the national health insurer) frames 갓생 as a reaction to burnout (S21 snippet).
- **Gaps:** I found no recent survey on what share of Korean students or workers use planners. I found no MAU for 열품타.

## Failure modes, with evidence

1. **Forgetting.** "I just didn't make it a habit and then kind of forgot about it." Repeated forgetting leads people to decide tracking is not worth it (S1, A).
2. **Upkeep burden.** "we just kind of stopped updating it because it was too much work to keep up to date". "grew tired of managing it" (S1, A). The Notion version: every database, relation and template adds maintenance, and templates force someone else's structure on you (S11, C, vendor).
3. **Entry too fine-grained, so people skip.** Breaking every meal into ingredients made p16 stop food tracking entirely (S1, A). Manual timers fail the same way. Toggl's fix is a separate manual mode for "time for an activity that already happened" (S25 snippet). A Clockify forum user complains that manual duration entry starts at the current time instead of the missed past time (S25 snippet).
4. **Early abandonment.** 18% of past location trackers quit within a week (S1). A 2024 JMIR scoping review of lifestyle and mental-health apps groups 22 abandonment reasons into 6 categories, including time cost and poor UX (S3 snippet). The figure of "median 70% stopped within 100 days" appeared **only in a search summary; I could not open the paper**. No independent day-30 retention figure for habit or planner apps was found. Vendor claims such as ">90% churn by day 30" are unverified.
5. **Guilt and a broken chain.** Half of lapsers feel guilty (S2). The idea that a reset streak causes quitting ("what-the-hell effect") is mostly supported by blogs. Lally 2010 found habit formation takes a median of 66 days, with a range of 18–254 days, and Lally stresses how variable it is (S26). I could not open the original paper to check the claim that a missed day doesn't matter.
6. **Tool switching and sprawl.** 53%, 72% and 78% of physical-activity, finance and location trackers had used more than one tool (S1). Consolidators like Akiflow exist to cut re-entry (S18 snippet). I found no hard data on the time lost to double entry.
7. **Building instead of using.** One r/Notion thread said the gain came from a weekly maintenance block, not from more building: "no system works if you don't use it" (S27 snippet; the page did not load).

## What keeps it going

- **Low cost per day.** 3–5 minutes each morning, logging the previous day, which makes backfill the normal routine (S12).
- **Coarse, forgiving data.** Yes/no fields and a 1–3 day score. A spreadsheet is "really forgiving of missing days." Fields change as goals change (S13).
- **Track only what is meaningful.** Avoid "data that isn't immediately meaningful" (S13).
- **Little structure, consistent rules.** Ango: "embraces chaos and laziness"; "collapses hundreds of future decisions into one"; "I enjoy this process" (S8).
- **The habit itself pays off, not the analysis.** The 8-year tracker values the habit-building more than reviewing the data (S12). An HN commenter called a year of food logging "an exercise in perfectionism" (snippet).
- **A weekly review is the anchor** (Forte, S15 snippet; Sunsama, S6). Epstein: physical-activity trackers often reviewed weekly, and finance data was useful when looked at weekly or monthly (S1).

## Implications (my interpretation, not findings)

- **Expect lapses and design for them.** Re-entry after a missed week should be a first-class flow: summarize the gap with passive data, don't punish, and skip the reset streak (S1, S2).
- **Passive capture goes straight at the top two failure modes**, forgetting and upkeep. Manual timers per course, as in the founder's Clockify use, are exactly the "skipping/forgetting" pattern.
- **Use one coarse daily signal.** A one-line reflection plus O/X habits matches what long-term trackers keep. Avoid granular required fields.
- **Make the weekly review the product's core,** with planned versus actual hours (like the 12WY execution score) computed automatically, not typed in.
- **For Korea,** 순공시간 and social proof (ranking, groups, 인증) are native motivators. A desktop planner may need a shareable weekly 순공/focus summary.

## Sources

- S1 Epstein, Ping, Fogarty, Munson, "A Lived Informatics Model of Personal Informatics," UbiComp '15. https://my.eng.utah.edu/~cs5540/au16/readings/PersonalInformatics-Epstein2015.pdf (A)
- S2 ScienceDaily on Epstein et al., UbiComp 2016 (lapsed Fitbit users). https://www.sciencedaily.com/releases/2016/09/160908141724.htm (B)
- S3 Kidman et al., JMIR 2024;26:e56897, abandonment of lifestyle and mental-health apps (snippet). https://www.jmir.org/2024/1/e56897 (A)
- S5 PPV summaries (snippet). https://readmedium.com/august-bradleys-notion-life-design-system-here-s-how-to-build-it-for-free-69fb92788cee (C)
- S6 Sunsama Help, Daily Planning. https://help.sunsama.com/docs/daily-planning (C, official vendor)
- S7 Periodic Notes plugin (snippet). https://notes.dsebastien.net/30+Areas/33+Permanent+notes/33.02+Content/Periodic+notes+plugin+for+Obsidian ; https://community.obsidian.md/plugins/journal-bases (C)
- S8 Steph Ango, "How I use Obsidian." https://stephango.com/vault (C)
- S9 Bullet Journal migration (snippet). https://bulletjournal.com/blogs/faq/migration ; https://www.nbcnews.com/better/business/want-be-more-mindful-organized-try-bullet-journal-ncna820726 (B/C)
- S10 12 Week Year summaries (snippet). https://yu-wenhao.com/en/blog/12-week-year-guide/ ; https://shortform.com/pdf/the-12-week-year-pdf-brian-p-moran (C)
- S11 Fabric, "Notion is a second job" (vendor). https://fabric.so/blog/notion-is-a-second-job (C)
- S12 "Eight years of tracking my life statistics." https://neurobiology.substack.com/p/eight-years-of-tracking-my-life-statistics (C)
- S13 Buster Benson, "What I'm tracking now and why." https://busterbenson.com/2012/11/04/what-im-tracking-now-and-why (C)
- S14 KR Notion study planners (snippet). https://nockmarket.gumroad.com/l/studyplanner ; https://notionflex.gumroad.com/l/flexible-study (C)
- S15 Tiago Forte on the weekly review (snippet). https://www.asianefficiency.com/podcasts/586-build-a-second-brain-tiago-forte/ (C)
- S16 Ali Abdaal annual review summary (snippet). https://summify.io/discover/the-most-productive-thing-i-do-each-year-ERGbgv/ (C)
- S17 Exist mood tracking (snippet). https://exist.io/about/mood/ (C)
- S18 Akiflow review (snippet). https://dhruvirzala.com/akiflow-review/ (C)
- S19 내 손안에 서울 / 서울연구원, 갓생 analysis (2023-02-23). https://mediahub.seoul.go.kr/archives/2006903 (B)
- S20 한경 잡앤조이, MZ challenges (2022-11). https://magazine.hankyung.com/job-joy/article/202211212467d (B)
- S21 갓생/챌린저스 and NHIS burnout framing (snippet). https://bravo.etoday.co.kr/view/atc_view/12094 ; https://www.nhis.or.kr/static/alim/paper/oldpaper/202211/sub/12.html (B)
- S22 열품타, KR App Store. https://apps.apple.com/kr/app/%EC%97%B4%ED%92%88%ED%83%80/id1441909643 (C)
- S23 10-minute study planner (snippet). https://www.yugacrew.com/crewletter/study-planner-printable (C)
- S24 강규형, 『성과를 지배하는 바인더의 힘』 (snippet). https://pedia.watcha.com/ko/contents/b98nG2b/book_description (C)
- S25 Toggl manual mode; Clockify forum (snippet). https://support.toggl.com/en/articles/5654561-why-can-i-no-longer-start-the-timer-in-the-desktop-app ; https://forum.clockify.me/t/change-start-time-when-entering-durations-manually/3287 (C/D)
- S26 Surrey interview with P. Lally (snippet). https://www.surrey.ac.uk/news/does-it-really-take-66-days-form-habit-we-asked-expert-dr-pippa-lally (B)
- S27 r/Notion thread (snippet; fetch failed). https://lr.us.psf.lt/r/Notion/comments/k4mlw0/ouch_this_one_hurts (D)

**Gaps I could not fill:** the JMIR full text (the 70%/100-day figure is unverified); independent retention numbers for habit or planner apps; a Korean usage survey; 열품타 MAU; a primary Reddit or HN thread on Notion burnout; data on double-entry time.
