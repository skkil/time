# desktop

Tauri 2 desktop app. Data is stored in `<app data dir>/com.skkil.time/time.db`
(`~/.local/share/com.skkil.time/time.db` on Linux). The UI lives in
[`apps/shared/app`](../shared/app); this app only installs the Tauri backend
and platform. The domain (types, migrations, rules, queries and the mutation
registry) is the [`time-core`](../core) crate; `src-tauri` keeps only Tauri
concerns: thin commands, dialogs, backups, reminders, quick capture,
ActivityWatch and the MCP server.

The first launch after the UUID migration (017) keeps the old database as
`time-before-uuid.db` next to `time.db`.

```bash
pnpm install       # from apps/
pnpm tauri dev     # development
pnpm tauri build   # installable bundle in src-tauri/target/release/bundle
```

See the root [AGENTS.md](../../AGENTS.md) for structure and commands.
