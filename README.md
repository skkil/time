# skkil/time

A personal planner for tasks, nested projects, time-blocking, time tracking,
habits, daily rituals and a weekly review, on desktop, web and phone.

Tasks work like Todoist (Quick Add with plain-word dates, repeats, priorities
and sub-tasks), projects can carry their own statuses, events and long-lived
records, and the week is planned on a schedule grid next to the time actually
tracked. Every app works offline.

## Architecture

```
            desktop (Tauri)        web (browser)          mobile (Expo)
            React UI               React UI               React Native UI
                 │                      │                      │
            time-core (native)     time-core (WASM)       time-core (uniffi)
            SQLite file            SQLite on OPFS         SQLite file
                 └──────────────┬───────┴──────────────────────┘
                                │  push / pull mutations
                        store service ── Kotlin server ── Postgres
```

- **One domain, three hosts.** `time-core` is a platform-free Rust crate that
  holds the types, migrations, rules, queries and the registry of every write.
  Desktop links it natively, web compiles it to WebAssembly and runs it in a
  worker on SQLite in the Origin Private File System, and mobile calls it
  through a uniffi Turbo Module.
- **Local-first.** Every app reads and writes its own SQLite replica, so the
  UI never waits on the network. A signed-out desktop stays fully local.
- **Sync through store.** Once signed in, each write is captured as a named
  mutation and pushed through [store](../store), a separate sync project
  pinned by `STORE_VERSION`. The Kotlin server replays the same mutation with
  the same rules on Postgres and is the source of truth; devices pull its log.
  Shared JSON vectors make the Rust and Kotlin registries prove they produce
  identical rows and ids.
- **One UI for desktop and web.** The React UI lives once in
  `apps/shared/ui`, behind a `Backend` port (the commands) and a `Platform`
  port (windows, files, account, sync).

## Tech stack

| Area | Stack |
|---|---|
| Domain | Rust, rusqlite, specta for generated TypeScript types |
| Desktop | Tauri 2, React 19 with React Compiler, TanStack Router and Query, Tailwind v4, shadcn/ui |
| Web | Vite, wasm-bindgen, SQLite on OPFS, Web Workers, a service worker for offline starts |
| Mobile | Expo 58, React Native 0.88, Expo Router, uniffi-bindgen-react-native |
| Server | Kotlin 2.3, Spring Boot 4.1, Java 25, Postgres 17, Flyway, OAuth2 resource server |
| Sync | store: store-core in Rust, adapter-jvm on the server, `@skkil/store-client` in TypeScript |
| Tooling | pnpm workspace, Vitest, ESLint, Prettier, Cargo, Gradle with Testcontainers |

## Repository layout

```
.
├── apps/
│   ├── desktop/          Tauri app: src/ (React shell), src-tauri/ (Rust host, MCP server)
│   ├── web/              Vite app; engine/ is time-core as WASM
│   ├── mobile/           Expo app; native/ is time-core as a Turbo Module
│   ├── server/           Kotlin Spring Boot API and the store write path
│   └── shared/
│       ├── core/         time-core, the Rust domain every app runs
│       ├── ui/           the desktop and web React UI
│       ├── design/       colours and the time-of-day sky
│       ├── rules/        platform-free rules: dates, timer, Quick Add parser
│       ├── client/       generated types, server client, local backend, sync, sign-in
│       └── config/       shared ESLint, Prettier and TypeScript configs
├── infra/compose.yaml    local Postgres, mock OIDC issuer and store service
├── assets/icon.svg       master for every app icon
├── skkil.yml             dev, doctor, ci and asset tasks for the skkil CLI
└── STORE_VERSION         the store tag this repo builds against
```

Each app folder has its own README.

## Run

You need Node 22+, pnpm, Rust, JDK 25, Docker and a store checkout at
`STORE_VERSION` in `../store` with `modules/client-ts` built. `skkil doctor`
checks all of it.

```bash
pnpm install
skkil dev        # Postgres, mock sign-in, store, server, web and desktop
```

Without the skkil CLI:

```bash
docker compose -f infra/compose.yaml up -d --build    # Postgres 5433, OIDC 8090, store 8091
(cd apps/server && ./gradlew bootRun)                  # API on 8080
pnpm --filter @skkil-time/core-wasm build              # the WASM engine, once
(cd apps/web && pnpm dev)                              # http://localhost:5173
(cd apps/desktop && pnpm tauri dev)
```

Sign in with any username on the mock issuer. Mobile needs its native
libraries first; see `apps/mobile/README.md`.

## Test

```bash
skkil ci         # format, lint, test and build for every app
```

Or per area: `pnpm lint`, `pnpm compile` and `pnpm test` at the root for the
TypeScript packages, `cargo test` in each Rust crate, and
`./gradlew spotlessApply test` in `apps/server`.

## Production

The server and web app ship as containers built with the store checkout as a
named build context (`docker build --build-context store=../store
apps/server`, and `docker build -f apps/web/Dockerfile --build-context
store=../store .`). The API runs on Postgres 17, migrates with Flyway on
start, holds no state of its own and scales horizontally. Store's service runs
beside it on the same database and verifies the API's ES256 sync tokens. Any
OIDC provider works: one API audience (`time-api`), a SPA client for web, and
public native clients for mobile and desktop. The desktop ships as a Tauri
bundle and mobile through EAS builds.

[AGENTS.md](AGENTS.md) describes the architecture and conventions in detail.
