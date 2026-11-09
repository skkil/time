# desktop

Tauri 2 desktop app. Data is stored in `<app data dir>/com.skkil.time/time.db`
(`~/.local/share/com.skkil.time/time.db` on Linux). The UI lives in
[`apps/shared/ui`](../shared/ui); this app only installs the Tauri backend
and platform. The domain (types, migrations, rules, queries and the mutation
registry) is the [`time-core`](../core) crate; `src-tauri` keeps only Tauri
concerns: thin commands, dialogs, backups, reminders, quick capture,
ActivityWatch and the MCP server.

Signed out, the desktop is fully local. Settings → Sync signs in through
the system browser and syncs with the server through skkil store (see
[the decision record](../../docs/decisions/0001-sync-with-store.md)). Build
with `SKKIL_SERVER_URL`, `SKKIL_AUTH_AUTHORITY`, `SKKIL_AUTH_CLIENT_ID` and
`SKKIL_AUTH_AUDIENCE` to change the defaults (local dev: `localhost:8080`,
`localhost:8090/default`, `time-desktop`, `time-api`); the issuer must allow
the public client `time-desktop` with a `http://127.0.0.1:*/callback`
redirect. Building needs the store checkout at `STORE_VERSION` in `../store`
(`skkil doctor` checks it).

The first launch after the UUID migration (017) keeps the old database as
`time-before-uuid.db` next to `time.db`.

```bash
pnpm install       # from apps/
pnpm tauri dev     # development
pnpm tauri build   # installable bundle in src-tauri/target/release/bundle
```

See the root [AGENTS.md](../../AGENTS.md) for structure and commands.
