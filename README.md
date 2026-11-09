# skkil/time

A planner for tasks, projects, time-blocking, time tracking, habits and weekly
review, on desktop, web and phone.

## Apps

Every app keeps its own SQLite copy of the data and works offline; signing in
syncs it with the server through [store](../store) (see
[the decision record](docs/decisions/0001-sync-with-store.md)).

| App | What it is |
|---|---|
| [`apps/desktop`](apps/desktop) | Tauri desktop app. Fully local until you sign in |
| [`apps/web`](apps/web) | Vite + React web app: the desktop UI in the browser, on SQLite in OPFS |
| [`apps/mobile`](apps/mobile) | Expo React Native app |
| [`apps/server`](apps/server) | Kotlin Spring Boot API on Postgres and the store write path |
| [`apps/shared/core`](apps/shared/core) | `time-core`, the Rust domain every app runs |
| [`apps/web/engine`](apps/web/engine) | `time-core` and store-core as WASM, for web |
| [`apps/mobile/native`](apps/mobile/native) | `time-core` and store-core as a React Native Turbo Module, for mobile |
| [`apps/shared`](apps/shared) | TypeScript packages the apps share |

## Run

```bash
pnpm install
skkil dev            # Postgres, mock sign-in, server, web and desktop
```

Or one app at a time; each app's README has its commands. See
[AGENTS.md](AGENTS.md) for architecture and conventions, and
[docs/deployment.md](docs/deployment.md) for production.
