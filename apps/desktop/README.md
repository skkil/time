# desktop

Tauri 2 desktop app. Data is stored in `<app data dir>/com.skkil.time/time.db`
(`~/.local/share/com.skkil.time/time.db` on Linux). The UI lives in
[`apps/shared/app`](../shared/app); this app only installs the Tauri backend
and platform.

```bash
pnpm install       # from the repo root
pnpm tauri dev     # development
pnpm tauri build   # installable bundle in src-tauri/target/release/bundle
```

See the root [AGENTS.md](../../AGENTS.md) for structure and commands.
