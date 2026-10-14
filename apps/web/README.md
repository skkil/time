# web

The desktop UI in the browser. It mounts [`apps/shared/app`](../shared/app)
with the HTTP backend from [`apps/shared/remote`](../shared/remote) and a
browser platform, and signs in through
[`apps/shared/auth`](../shared/auth).

```bash
pnpm dev       # http://localhost:5173, needs the server (see apps/server)
pnpm build     # dist/
```

Configuration comes from `VITE_API_URL`, `VITE_AUTH_AUTHORITY`,
`VITE_AUTH_CLIENT_ID` and `VITE_AUTH_AUDIENCE` (see `.env.example`). In the
container (`docker build -f web/Dockerfile .` from `apps/`),
`API_URL`, `AUTH_AUTHORITY`, `AUTH_CLIENT_ID` and `AUTH_AUDIENCE` are written
to `config.js` at start, so one image serves every environment.

Desktop-only features (global capture hotkey, native reminders, ActivityWatch
tracking, database-file backups) are hidden through `Platform.features`.
