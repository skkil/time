# Personal time awareness · Market scan (evidence appendix)

_Retrieved 2026-10-18 by 5 parallel research passes · Staleness horizon: 90 days · Prices change often; recheck before pricing decisions_

Source grades: A official/filings · B reputable press/analytics · C company blog/vendor report · D forums/reviews.

## A. Screen-time and blocking apps

| Product | Platforms | Price | Traction (sourced) | Top complaints |
|---|---|---|---|---|
| Opal | iOS, Android, Mac | Free 1 rule; Pro $19.99/mo, $99.99/yr, $399 lifetime | 4.7★ (90K); $10M ARR, 11 people (Speedinvest 2025-05); 2/3 of DAU students (RevenueCat 2026-04) | Easy bypass, no Windows |
| one sec | iOS (+others per site) | $6.99/mo, $19.99/yr, $99.99 lifetime | 4.8★ (24K); PNAS study 57% fewer opens; 18 people | Price, easy to disable |
| ScreenZen | iOS, Android, Mac, Win | Free, donations | 4.9★ (52K); 500K+ MAU (self-reported) | none found |
| Brick | iOS, Android | $59 device | 4.9★ (58K) | Disable in Settings bypass |
| Clearspace | iOS, Android, Chrome | $6.99-79.99 IAP | 4.7★ (8.9K) | Weak free tier, not ADHD friendly |
| Jomo | Apple only | Not found | 4.8★ (2.5K) | Weak analytics; no other-device data |
| Freedom | Mac, Win, iOS, Android, ChromeOS | $8.99/mo, $3.33/mo annual | iOS 4.4★ (6K) | Blocking silently stops |
| Cold Turkey | Win, Mac | ~$39 one-time (third-party) | — | No mobile, dated UI |
| Unpluq | iOS, Android | $29 / 3 months | 4.8★ (927) | Schedule bugs |

Built-ins: Apple Screen Time ("Ignore Limit" one tap, iOS 26 reset bugs); Android Digital Wellbeing (easy bypass, inaccurate usage, "Beta" since 2018 per 9to5Google 2026-02).

## B. Gamified focus and habit apps

| App | Loop | Price | Traction |
|---|---|---|---|
| Forest | Tree dies if you leave | Freemium since Dec 2025; Plus $5.99/mo | 60M+ downloads (self-reported) |
| Focus Friend | Bean knits while you focus | Free; Pro $3.99/mo, $19.99/yr, $39.99 lifetime | #1 US App Store Aug 2025; Google Play App of the Year 2025 |
| YPT (열품타) | Study stopwatch, groups, rankings | Premium $4.99/mo, $29.99/yr | ~5M global users (listing) |
| Finch | Self-care pet | Plus $5.99-69.99 | 4.9★ (765K) |
| Structured | Visual timeline | Pro up to $99.99 lifetime | 1.7M downloads by 2022 (solo start) |
| Tiimo | ADHD visual planner | Pro $7-54 | 50K+ paying (2024-08); iPhone App of the Year 2025; $4.8M raised |
| Habitica, Flora, Study Bunny, Session, Focusmate, Streaks | see sources | | |

Complaint themes (10 apps): bugs/data loss 7/10, grindy pricing/ads 5/10, blocking friction 4/10, content runs out 4/10, platform/timezone gaps 4/10, punished for breaks 3/10.

## C. Automatic and personal time trackers

| Product | Target | Platforms | Price | Note |
|---|---|---|---|---|
| Rize | Agencies, freelancers | Mac, Win | $9.99-39.99/mo, no free tier | Repositioned to client profitability |
| Timing | Individuals to teams | macOS only | from $10/mo | Polished |
| RescueTime | Freelancers, teams | Desktop, iOS, Android | Free Lite; $7-15/mo | Trustpilot 2.3/5, billing complaints |
| ActivityWatch | Privacy-minded | Win, Mac, Linux, Android | Free (MPL-2.0) | Sync in v0.14 (Oct 2026); 1.18M downloads |
| Memtime | Freelancers, legal | Win, Mac, Linux | €10-30/user/mo | Offline |
| Toggl / Clockify | Freelancers, teams | All (Toggl no Linux) | Free tiers; per seat | Billing-centric UI |
| Early (Timeular) | Teams | — | Redirects to TimeTac | Acquired, 2026-09 |
| Exist.io | Personal QS | iOS, Android, web | $6.99/mo | No computer-time capture |
| Dayflow | AI work journal | macOS | Free, MIT | YC; 7K+ GitHub stars |
| Screenpipe | AI context | Mac, Win, Linux | $21/mo | Sync only on Business |
| Rewind/Limitless | — | — | Discontinued | Meta acquisition; Mac capture off 2025-12-19 |

Complaint themes (~165 HN comments, 14 Trustpilot, top 15 ActivityWatch issues): privacy/cloud (strongest), platform gaps incl. Linux/Wayland and multi-device sync (ActivityWatch issue: 103 reactions), billing distrust, categorization accuracy, loss of granular insight.

## D. Demand and benchmarks

- Pew 2026-09-01 (n=9,750): 53% too much phone time; 70% of 18-29; 45% tried to cut back, 25% of those very successful.
- OUP 2024-12-02: "brain rot" Word of the Year.
- CDC/NCHS 2024-10: 15.5M US adults with current ADHD diagnosis.
- RevenueCat SOSA 2026: median download-to-paid 2.0% (H&F 2.9%); 17.3% of new apps reach $1K MRR in 2 years, 4.6% reach $10K.
- Adapty SOIS 2026: H&F annual plans 60.6% of revenue; 57.7% of new subscription apps earn under $1K total.

## E. Platform feasibility

| Platform | Capture active app | Title/URL | Export to own store | Block | Main risk |
|---|---|---|---|---|---|
| iOS | Opaque tokens only | No | **No** (sandboxed report) | Yes | Family Controls entitlement per extension, weeks of review; iOS 26 phantom events |
| Android | Yes (UsageStatsManager) | Needs AccessibilityService | Yes; events kept a few days | Overlay/accessibility | Play declaration review; Android 17 Advanced Protection Mode |
| macOS | Yes | Needs Screen Recording (monthly re-prompt) | Yes | Possible | Permission friction; iPhone import via Biome is undocumented |
| Windows | Yes (SetWinEventHook) | Yes | Yes | Yes | Low |
| Linux | X11 easy; Wayland per compositor | GNOME needs extension | Yes | Hard | GNOME extension fragility |
| Browser MV3 | Yes | Yes | Yes | Yes | Service worker killed after 30s idle |

Sync options: Evolu (SQLite, E2EE relays, MIT), PowerSync (free tier, $49/mo Pro, no native E2EE). Framework: Tauri 2 (Rust core) for desktop; native Swift for iOS extensions; Kotlin for Android; TypeScript extension.

## Gaps

Google Trends (429), Reddit (blocked), Google Play pages (did not render), G2/Capterra (403). No audited revenue for ScreenZen, Forest, Tiimo, one sec, Focus Friend, Finch, Structured. No evidence on willingness to pay for cross-device awareness specifically. No retention data for tracking apps.

## Sources

**A**
- https://www.pewresearch.org/short-reads/2026/09/01/about-half-of-americans-say-they-spend-too-much-time-on-their-smartphone/
- https://www.pewresearch.org/internet/2024/03/11/how-teens-and-parents-approach-screen-time/
- https://corp.oup.com/news/brain-rot-named-oxford-word-of-the-year-2024/
- https://pmc.ncbi.nlm.nih.gov/articles/PMC11466376/
- https://opalapp.com/pricing · https://freedom.to/pricing · https://getcoldturkey.com/pricing/
- https://rize.io/pricing · https://timingapp.com/pricing · https://rescuetime.com/pricing · https://activitywatch.net · https://github.com/ActivityWatch/activitywatch/issues · https://memtime.com/pricing · https://toggl.com/track/pricing/ · https://clockify.me/pricing · https://exist.io · https://manictime.com/pricing · https://wakatime.com/pricing · https://dayflow.so · https://screenpipe.com/pricing · https://limitless.ai
- https://www.focusmate.com/pricing · https://www.stayinsession.com/pricing · https://focusfriend.me/ · https://www.forestapp.cc/
- App Store listings: Opal id1497465230, one sec id1532875441, ScreenZen id1541027222, Brick id6448794069, Clearspace id1572515807, Jomo id1609960918, Freedom id1269788228, Unpluq id1673743726, Forest id866450515, Focus Friend id6742278016, Finch id1528595748, YPT id1441909643, Flora id1225155794, Study Bunny id1478345385, Habitica id994882113, Structured id1499198946, Tiimo id1480220328, Streaks id963034692, Toggl id1291898086
- Apple: https://developer.apple.com/tutorials/data/documentation/deviceactivity/deviceactivityreport.json · https://developer.apple.com/forums/thread/717912 · https://developer.apple.com/tutorials/data/documentation/familycontrols/requesting-the-family-controls-entitlement.json
- Android: https://developer.android.com/reference/android/app/usage/UsageStatsManager · https://support.google.com/googleplay/android-developer/answer/10964491
- Microsoft: https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwineventhook
- Chrome: https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle

**B**
- https://techcrunch.com/2021/01/26/opal-raises-4-3-million-for-its-digital-wellbeing-assistant-for-iphone/
- https://techcrunch.com/2026/06/24/if-you-want-to-cut-your-screen-time-just-get-a-brick/
- https://techcrunch.com/2025/08/18/hank-greens-focus-friend-app-is-climbing-the-app-store-charts-and-its-extremely-cute
- https://techcrunch.com/2025/11/18/hank-greens-focus-friend-is-google-plays-app-of-the-year
- https://9to5google.com/2026/02/20/google-has-ignored-androids-digital-wellbeing-tools-for-years-so-whats-next/
- https://www.macworld.com/article/2429205/macos-sequoia-requires-regular-permission-checks-when-using-certain-apps.html
- https://www.malwarebytes.com/blog/mobile/2026/03/google-cracks-down-on-android-apps-abusing-accessibility

**C**
- https://www.revenuecat.com/state-of-subscription-apps/ · https://adapty.io/blog/mobile-app-monetization-2026/
- https://www.speedinvest.com/knowledge/scaling-smart-how-opal-built-a-10m-arr-business-in-just-2-years
- https://www.revenuecat.com/blog/growth/kenneth-schlenker-sub-club-podcast-2026
- https://www.revenuecat.com/blog/growth/frederik-riedel-expected-12-his-app-cut-screen-time-by-57/
- https://www.tiimoapp.com/resource-hub/tiimo-raises-4-8m-neurodivergent-planner · https://structured.app/blog/2-years · https://www.failory.com/interview/rize
- https://screenzen.co · https://getbrick.com · https://jomo.so · https://unpluq.com · https://www.getclearspace.com
- https://www.timetac.com/en/blog/early-joins-timetac/ · https://gummysearch.com/r/digitalminimalism/ (and r/nosurf, r/ADHD, r/productivity, r/getdisciplined, r/QuantifiedSelf)
- https://www.evolu.dev/ · https://www.powersync.com/pricing · https://v2.tauri.app/develop/plugins/develop-mobile/
- https://matteing.com/writing/a-curious-way-to-grab-screen-time-data-on-ios · https://dev.to/twillywill/the-ios-screen-time-api-in-2026-what-apples-docs-dont-tell-you-151e

**D**
- https://news.ycombinator.com/item?id=45361268 · https://news.ycombinator.com/item?id=28683597 · https://news.ycombinator.com/item?id=40977453 · https://news.ycombinator.com/item?id=20349158
- https://forum.quantifiedself.com/t/automated-time-tracking/2574 · https://www.trustpilot.com/review/rescuetime.com
- https://developer.apple.com/forums/thread/727291 · https://discussions.apple.com/thread/256258057
- https://github.com/ActivityWatch/aw-import-screentime · https://github.com/2e3s/awatcher · https://github.com/flexagoon/focused-window-dbus
- justuseapp.com review pages for Forest, Finch, Habitica, YPT, Study Bunny
