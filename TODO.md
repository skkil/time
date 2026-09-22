# TODO: QA backlog

From the full QA pass on 2026-11-07, on `main` at `e5679fb`, with the real
backend and a seeded scratch database. Work top to bottom; the order is the
recommended order. Each item is one change.

Unless marked otherwise, every item was reproduced in the running app.
`[decide]` means it needs your call first. `[recheck]` means confirm the problem
before building. Items in "Product gaps" and "Remove or hide" are judgment, not
user research.

## P0: Data safety

- [x] **1. Make Drop safe.** Drop in Leftovers and Check out deletes the task
      with no confirmation, undo or message.
  - Repro: Day → "N left from earlier days" → Drop.
  - Where: `apps/desktop/src/features/day/Leftovers.tsx`; the Check out
    leftovers step.
  - Done when: Drop shows a message with Undo, and Undo restores the task with
    its steps and blocks. Either a repeating task is handled explicitly, or Drop
    is unavailable for it.
- [x] **2. Add undo for destructive and scheduling actions.** `Ctrl+Z` does
      nothing, and only one toast success path exists in the app.
  - Done when: Drop, Delete, Done, Discard timer and moving a block or task each
    offer Undo for at least 5 seconds, and `Ctrl+Z` triggers the latest one
    outside text fields.
- [x] **3. Add export and backup.** Settings → Data offers only Delete all data.
  - Where: `apps/desktop/src/features/settings/DataSettings.tsx`.
  - Done when: the user can export the whole database to a chosen file and
    restore from one, the restored data opens correctly, and the delete dialog
    no longer has to say "There is no backup".

## P0: Daily loop

- [x] **4. Make Time and Repeat reachable in the date picker.** From the Day
      task panel the popover runs to y=927 in an 820px window and can't scroll.
  - Repro: Day → open a task → click its date.
  - Done when: the whole popover is reachable at the default 1200×820 window
    from every place it opens.
- [x] **5. Make Day circles complete tasks.** They look like checkboxes but only
      select the row.
  - Done when: clicking the circle completes the task, clicking the title opens
    it, and the row gives visible feedback.
- [x] **6. Show timed tasks at their time on Day.** "Call dentist today 8pm"
      lands in "Any time today" with no time, while Week shows it at 20:00.
  - Where: `apps/desktop/src/features/day/DayCanvas.tsx`.
  - Done when: a task with a due time appears on the timeline at that time, and
    Day and Week agree.
- [x] **7. Stop Quick Add corrupting titles.** "Weekly review every friday at
      5pm for 30m" saves as "review every".
  - Where: `apps/desktop/src/features/tasks/quick-add/parser/repeats.ts`.
  - Done when: that phrase saves as "Weekly review" repeating every Friday at
    17:00 for 30m, with a test beside the parser. A repeat word that starts a
    title stays in the title when a later `every …` phrase is present.
- [x] **8. Keep Continue on screen in Check out.** With 11 leftovers at
      1200×820, Continue sits at y=817–849 of 820, with no scroll hint.
  - Done when: Back and Continue stay visible at any list length, and the list
    scrolls inside the card.
- [x] **9. Add reminders.** Nothing alerts the user at a due time. There is no
      notification code or plugin.
  - Done when: a timed task fires a desktop notification at its time, it can be
    turned off in Settings, and clicking it opens the task.
- [x] **10. Reduce idle CPU.** The real instance used about 37% of a core plus
      about 10% in WebKit while hidden and unfocused, in one 20-second sample,
      with about 930 MB of memory.
  - Fixed 2026-11-08: the four drifting sky glows repainted the window
    continuously. Animations now pause while the window is hidden or
    unfocused. Under Xvfb, unfocused: app 4.0% → 0.0%, WebKit 16% → 0.2% over 3
    minutes. Memory was not addressed.
  - Done when: the cause is found, animation stops while the window is hidden,
    and idle CPU while hidden is near 0%. Remeasure over several minutes.

## P1: First run

- [x] **11. Add a first-run path.** There is no onboarding or sample data, and
      empty Day, Week and Projects give no guidance.
  - Done when: a new user sees how to add a first task on an empty Day, and each
    empty screen says what belongs there with one action.
- [x] **12. Show projects when Projects opens.** It opens Inbox with the sidebar
      hidden, so no projects are visible.
  - Done when: a user with projects can see them straight after clicking
    Projects.
- [x] **13. Confirm Quick Add results.** Undated tasks such as "buy milk" vanish
      after adding.
  - Done when: a message names the task and where it went, with a link to it.
- [x] **14. Add an "add another" mode to Quick Add.** Enter closes it, and
      further typing goes to the page.
  - Done when: a modifier key or toggle keeps it open and focused for the next
    task.
- [x] **15. Add a shortcut sheet.** `?` and `F1` do nothing.
  - Done when: `?` opens a list of all shortcuts, outside text fields.

## P1: Quick Add

- [x] **16. Flag unknown projects.** `#Bills` stays in the title silently when
      no such project exists.
  - Done when: the user can create the project or see a warning before saving.
- [x] **17. Parse "yesterday" and handle near-miss dates.** "yesterday" stays in
      the title, and "next fryday" gives no hint.
  - Done when: "yesterday" sets the date, and common typos are parsed or
    suggested.
- [x] **18. Stop losing repeated tokens.** "p1 p2 tomorrow every" saved the
      title "p2 every" with priority 1.
  - Done when: only the matched token is consumed, and the rest stays in the
    title as typed.
- [x] **19. Support Korean dates and times.** The parser has no Korean grammar,
      so "내일 오후 3시" stays in the title.
  - Done when: common Korean date and time phrases parse, with tests beside the
    parser.

## P1: Day

- [ ] **20. Label habit dots.** Three bare circles under the date only make
      sense on hover.
  - Done when: each is identifiable without hovering, or it moves out of Day
    (see item 49).
- [x] **21. Fix the "Any time today" overflow.** With 6 or more tasks the list
      clips a row and Add scrolls out of view.
  - Done when: Add stays reachable and no row is cut off at 1200×820.
- [x] **22. Make overdue visible.** Overdue work is a faint "N left from earlier
      days", and overdue dates look normal in the task panel.
  - Done when: overdue dates are visually distinct everywhere, and the Day entry
    point meets the contrast target in item 42, in neutral wording.
- [x] **23. Give finished tasks feedback.** Completed tasks disappear from Day.
  - Done when: a finished task stays briefly as done, and today's finished tasks
    can be found on Day.

## P1: Timer

- [x] **24. Show the running timer once.** It appears in the top bar, the Start
      focus button and the panel at the same time.
  - Done when: the timer shows in one place on each screen, or a second place
    only if it adds a control.
- [x] **25. Fix rounding in focus totals.** A 2-second session moved the total
      from 1h 55m to 1h 56m and back, and an empty day showed "1m focused" after
      1 second.
  - Done when: running and saved totals use the same rounding, and sessions
    under a minute don't inflate the total.
- [x] **26. Protect Discard.** One click throws away a running session, and it
      sits right beside Stop.
  - Done when: covered by Undo from item 2, or it asks for confirmation once a
    session passes a set length.
  - Covered by item 2: Discard offers Undo, which restores the running session.

## P1: Week

- [x] **27. Make overlapping blocks readable.** At the default width they shrink
      to "Ru…", "Ca…" and "Pr…".
  - Done when: each block's title is identifiable through hover or a wider
    layout at 1200×820.
- [x] **28. Separate planned from tracked time.** They look alike, there is no
      legend, and tracked blocks show only the project.
  - Done when: the two are distinct at a glance, and tracked blocks name the
    task when one is linked.
- [x] **29. Stop due cards looking like blocks.** After moving Draft chapter 2
      to Friday, Saturday still shows a matching card at 09:00.
  - Done when: a due card can't be mistaken for a planned block.
- [x] **30. Remove triple listing.** One task can appear as a day chip, a grid
      item and a rail card.
  - Done when: a task with a place on the grid isn't repeated as a chip.
- [x] **31. Make very short entries clickable.** A 5-minute entry renders as a
      3px line.
  - Done when: entries keep a minimum clickable height.
- [x] **32. Clean up scrollbars.** The rail and grid scrollbars are nested, and
      one sits over Sunday.
  - Done when: no scrollbar overlaps content, and only one scroll area is active
    at a time.

## P1: Check out

- [x] **33. Fix the time-block step with no musts.** It says "Every must has a
      time" when none were picked.
  - Done when: the step is skipped or says so plainly when there are no musts.
- [x] **34. Keep tonight's plans out of Leftovers.** Tasks and blocks still
      ahead today are listed as leftovers.
  - Done when: they are excluded or clearly marked as still planned.
- [x] **35. Clarify "Leave" and "Not today".** The two exits are hard to tell
      apart.
  - Done when: each label says what happens to the check-out.
- [x] **36. End Check out with closure.** Finish only changes the button to
      "Checked out".
  - Done when: the last step summarises the day and tomorrow's plan.

## P1: Projects and search

- [x] **37. Fix "Next" and "After that".** "Next" chose an overdue P2 over a P1
      due today, and "After that" starts with an item from yesterday and repeats
      tasks.
  - Where: `apps/desktop/src/features/projects/context.ts`.
  - Done when: the ordering rule is written down and tested, and no task appears
    twice.
- [x] **38. Show row actions without hover.** Four row actions only appear on
      hover.
  - Done when: they are reachable by keyboard, and the main ones are
    discoverable without hovering.
- [x] **39. Use the space in Timeline.** It shows 5 rows in a small box with
      half the window empty.
  - Done when: it fills the available height.
- [x] **40. Remove Board's page scrollbar.** It appears with only two columns.
  - Done when: a horizontal scrollbar appears only when columns overflow.
  - The Add section column was a full 288px column, so two sections plus it
    overflowed beside the side panel. It is now 176px. Not reproduced in
    WebKitGTK; recheck in the real app.
- [x] **41. Tighten search.** "sink" returned an unrelated long task, and
      "Draft" did too.
  - Done when: exact and prefix matches rank first, and weak fuzzy matches are
    dropped.

## P2: Design and language

- [x] **42. Raise text contrast.** Hour labels are about 2.9:1 and "Any time
      today" about 3.7:1 (estimated from colours), and both are 11px or smaller.
  - Done when: body and label text reach 4.5:1 across the sky at every time of
    day.
- [x] **43. Check the keyboard focus ring.** `[recheck]` I detected no visible
      ring after tabbing to a tab button.
  - Done when: every interactive element shows a visible focus state.
  - Rechecked 2026-11-08 in the mocked preview: tabs, buttons, links and checks
    show a ring; task titles show an underline. Not reproduced.
- [x] **44. Unify dialogs.** Quick Add, Leftovers, Settings and the project
      wizard each use a different surface, and the Timeline table is opaque.
  - Done when: there is one dialog style and one table style.
- [ ] **45. Reconcile sky and ocean.** `[decide]` Rituals switch to a realistic
      ocean, a 12 MB file, while the app is a soft gradient.
  - Done when: rituals and the app feel like one product, whichever way you
    decide.
- [x] **46. Restyle tooltips.** The black "Ctrl 2" box stays up after clicking
      and clashes with the UI.
  - Done when: tooltips match the theme and hide on click.
- [ ] **47. Settle the vocabulary.** Begin / Start focus; Timer / Focus /
      focused / tracked; Drop / Delete; must / outcome / priority; the "Calm"
      settings section.
  - Done when: one term is chosen for each idea and applied everywhere.
- [ ] **48. Standardise units and explain labels.** "3.3 h" sits beside "3h
      20m", and "13 of 15 so far" and "Make it smaller" don't explain
      themselves.
  - Done when: durations use one format, and those labels make sense on their
    own.

## Remove or hide

All `[decide]`: these are recommendations.

- [ ] **49. Remove habit dots from Day,** or keep them with labels (item 20).
- [ ] **50. Merge "Start focus" and "Begin"** into one action.
- [ ] **51. Make "Pick musts" and "Time-block" optional** in the default Check
      out.
- [ ] **52. Hide advanced project setup** (types, statuses, milestones, stop-if
      rules, review rhythm) behind "Advanced".

## Product gaps

All `[decide]`: likely user wants, not validated.

- [ ] **53. Global quick-capture hotkey.**
- [ ] **54. Calendar sync.**
- [ ] **55. Import from other task apps.**
- [ ] **56. Light theme.**
- [ ] **57. Phone capture.**
- [ ] Breaks in focus mode sessions, and a way to stop/resume them. Also there
      is no way to remove a focus session from the timeline.

## Still to test

- [ ] **58. Finish the QA pass.** Not covered on 2026-11-07:
  - Minimum window size (900×600) and real GPU rendering
  - Weekly Review past its first screen, morning ritual and sleep hours
  - Creating habits, and dragging tasks in List and Board
  - Records, dependencies, saved views, ActivityWatch and weather
  - Dropping a repeating task, which may delete the whole series (affects
    item 1)
