# skkil/time

A planner for tasks, projects, time-blocking, time tracking, habits and weekly
review, on desktop, web and phone.

## Apps

| App | What it is |
|---|---|
| [`apps/desktop`](apps/desktop) | Tauri desktop app. Local-first: one SQLite file, no account |
| [`apps/server`](apps/server) | Kotlin Spring Boot API on Postgres, for web and mobile |
| [`apps/web`](apps/web) | Vite + React web app: the desktop UI over the API |
| [`apps/mobile`](apps/mobile) | Expo React Native app |
| [`apps/shared`](apps/shared) | TypeScript packages every app shares |

## Run

```bash
pnpm install
skkil dev            # Postgres, mock sign-in, server, web and desktop
```

Or one app at a time; each app's README has its commands. See
[AGENTS.md](AGENTS.md) for architecture and conventions, and
[docs/deployment.md](docs/deployment.md) for production.
