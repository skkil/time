# Repo layout migration

Status: proposed, not started. Written 2026-11-09.

## Goal

Every app lives entirely in its own directory under `apps/`, including the
Rust code that adapts time-core for it. Code used by more than one app lives in
`apps/shared/`. The pnpm workspace moves to the repo root. Environment code
that isn't part of one app goes in `infra/`.

## Target layout

```
/
├── package.json, pnpm-workspace.yaml, pnpm-lock.yaml, .dockerignore
├── infra/
│   └── compose.yaml          local stack: Postgres, mock OIDC, store service
├── apps/
│   ├── shared/
│   │   ├── core/             time-core (Rust), from apps/core
│   │   ├── rules/            from apps/shared/domain (@skkil-time/rules)
│   │   └── app/ tokens/ contract/ api/ remote/ local/ sync/ auth/ tooling/
│   ├── desktop/   src/ + src-tauri/
│   ├── web/       src/ + engine/   from apps/core-wasm
│   ├── mobile/    src/ + native/   from apps/core-native
│   └── server/
└── docs/, assets/, skkil.yml, STORE_VERSION
```

## Rules this layout follows

- `apps/<app>/` holds everything only that app uses: its UI, its Rust bridge
  (`src-tauri`, `engine`, `native`), its Dockerfile, nginx config,
  entrypoint and scripts. Deleting the folder deletes the app.
- `apps/shared/` holds what several apps use: time-core and the TypeScript
  packages.
- `infra/` holds what sets up the environment around the apps or spans several
  of them. Today that is only the local compose stack. Future TLS proxy,
  hosting and Terraform code goes in `infra/deploy/`.
- Each Rust crate keeps its own `Cargo.lock`. There is no root Cargo
  workspace: time-core's default `native` feature (bundled SQLite) must stay
  off for the wasm build, and building the crates together in one workspace
  can turn it back on through feature unification.

## Before starting

1. **The other agent is idle.** A tree move breaks any build running against
   the old paths. Confirm with the user first.
2. **Clean baseline.** Start from a clean working tree on a branch
   (`chore/repo-layout`) and run `skkil ci`. Note anything already failing,
   so failures during the move can be attributed correctly.
3. **Use `git mv` for every move,** so `git log --follow` keeps history.
4. **Each step below is one commit** and ends with its checks passing. Don't
   start the next step on a red build.

## Step 1: workspace to the repo root

Moves:

- `apps/package.json` → `package.json` (rename to `skkil-time`)
- `apps/pnpm-workspace.yaml` → `pnpm-workspace.yaml`
- `apps/pnpm-lock.yaml` → `pnpm-lock.yaml`
- `apps/.dockerignore` → `.dockerignore`

Edits:

- `pnpm-workspace.yaml`: prefix every glob with `apps/` (`apps/core-wasm`,
  `apps/desktop`, `apps/web`, `apps/mobile`, `apps/core-native`,
  `apps/shared/*`). Keep the React overrides.
- `.dockerignore`: prefix the existing entries with `apps/`. Add `docs`,
  `assets`, `.design`, `.jennifer` and the root markdown files.
- Delete every `node_modules` (`apps/node_modules` and each package's), then
  run `pnpm install` at the root.
- `apps/web/Dockerfile`: the build context becomes the repo root, because the
  install needs the root lockfile. Prefix every `COPY` source with `apps/`,
  set `WORKDIR /work/time` in the build stage, and change the header comment
  to `docker build -f apps/web/Dockerfile --build-context store=../store .`
  Keep the wasm stage's paths under `/work/time/apps/...` so time-core's
  relative path to `/work/store` still resolves.
- `skkil.yml`: change the `workspace dependencies` check to
  `test -d node_modules` and its hint to `pnpm install`.
- Mobile: delete `apps/mobile/android/app/.cxx`,
  `apps/core-native/android/.cxx` and `apps/mobile/android/.gradle`. They
  hold absolute paths into `apps/node_modules`. Expo finds the workspace root
  from `pnpm-workspace.yaml`, so `metro.config.js` needs no change. Check
  that its store-client watch folder still resolves.
- Docs: change the workspace paragraph in `AGENTS.md` ("Run `pnpm install`
  once in `apps/`…", and the line naming `apps/package.json`) and the web
  build command in `docs/deployment.md`.

Verify:

- `pnpm lint && pnpm compile && pnpm test` at the root
- `pnpm --filter @skkil-time/web build`
- `docker build -f apps/web/Dockerfile --build-context store=../store .`
- In `apps/mobile`: `npx expo export --platform android`, then
  `./scripts/run-android.sh` on the emulator
- In `apps/desktop`: `pnpm tauri dev` starts

Commit: `build: move the pnpm workspace to the repo root`

## Step 2: `apps/core` → `apps/shared/core`

Edits:

- `apps/shared/core/Cargo.toml`: change the store path from
  `../../../store/...` to `../../../../store/...`.
- time-core sources that `include_str!` contract files: in each, change
  `../../../shared/<x>` to `../../../<x>`.
  - `src/mutations/tests.rs` (`bindings.ts`, `commands.json`)
  - `src/mutations/vectors.rs` (`mutation-vectors.json`)
  - `src/env/seed.rs` (`natural-keys.json`)
  - `src/recurrence/mod.rs` (`repeat-phrases.json`, still under `domain/` at this step)
- Path dependencies on time-core:
  - `apps/core-wasm/Cargo.toml`: `../shared/core` (a temporary path; step 3 changes it again)
  - `apps/core-native/Cargo.toml`: `../shared/core` (temporary; step 4 changes it again)
  - `apps/desktop/src-tauri/Cargo.toml`: `../../shared/core`
- `apps/web/Dockerfile`, wasm stage: `COPY apps/shared/core /work/time/apps/shared/core`.
- `skkil.yml`: time-core task `dir: apps/shared/core`.
- `apps/shared/README.md`: add `core` and say it is Rust.
- Unchanged: `src-tauri/src/lib.rs` writes `bindings.ts` relative to its own
  manifest, and `apps/shared/contract` doesn't move.

Verify:

- In `apps/shared/core`:
  - `cargo fmt --check`
  - `cargo clippy --all-targets --features specta -- -D warnings`
  - `cargo test`
  - `cargo build --target wasm32-unknown-unknown --no-default-features`
- `cargo test` in `apps/core-wasm`, `apps/core-native` and
  `apps/desktop/src-tauri`, then
  `git diff --exit-code apps/shared/contract/src/bindings.ts`

Commit: `refactor: move time-core into apps/shared/core`

## Step 3: `apps/core-wasm` → `apps/web/engine`

The move carries `Cargo.toml`, `Cargo.lock`, `package.json`, `src/`,
`tests/`, `scripts/`, `.gitignore` and `.prettierignore`. Don't move
`target/` or `pkg/`: delete them and rebuild.

Edits:

- `apps/web/engine/Cargo.toml`: time-core path `../../shared/core`.
- `pnpm-workspace.yaml`: replace `apps/core-wasm` with `apps/web/engine`.
  The package name `@skkil-time/core-wasm` stays, so web's import and
  `vite.config.ts` don't change.
- Stop web's own tools from sweeping into the nested package:
  - `apps/web/eslint.config.js`: add `engine/**` to `ignores`
  - `apps/web/.prettierignore`: add `engine/`
  - Confirm that `tsconfig.app.json`'s `include` and the vitest config only
    cover `src/`
- `.dockerignore`: `apps/web/engine/pkg` and `apps/web/engine/target`.
- `apps/web/Dockerfile`, wasm stage:
  - `WORKDIR /work/time/apps/web/engine`
  - `COPY apps/web/engine/Cargo.toml ./`
  - `COPY apps/web/engine /work/time/apps/web/engine`
  - cache mount at `/work/time/apps/web/engine/target`
  - The build stage copies the output with
    `COPY --from=wasm /work/time/apps/web/engine/pkg apps/web/engine/pkg`
- `skkil.yml`:
  - the `wasm-bindgen-cli` check and hint read `apps/web/engine/Cargo.toml`
  - the `core-wasm` CI task becomes `web-engine` with `dir: apps/web/engine`
  - the `web` task's `depends_on` follows the rename
- Docs: change the core-wasm paths in `apps/web/README.md`, `AGENTS.md`
  (repo structure and the web section) and
  `docs/decisions/0001-sync-with-store.md`. Update the paths only; leave the
  decision text as written.

Verify:

- In `apps/web/engine`: `cargo clippy --all-targets -- -D warnings`,
  `cargo test` and `sh scripts/build.sh`
- In `apps/web`: `pnpm lint && pnpm test && pnpm build`
- The Docker build from step 1, then load the image in a browser: it starts
  offline and syncs

Commit: `refactor: web owns its wasm engine (apps/web/engine)`

## Step 4: `apps/core-native` → `apps/mobile/native`

This is the most fragile step, because of the generated bindings and native
build caches. The move carries `Cargo.toml`, `Cargo.lock`, `.cargo/`,
`package.json`, `src/`, `cpp/`, `android/`, `ios/`, `CoreNative.podspec`,
`ubrn.config.yaml`, `uniffi.toml`, `scripts/`, `tsconfig.json`,
`eslint.config.js`, `.gitignore` and `.prettierignore`. Don't move
`target/`, `android/.cxx`, `android/build` or `jniLibs`.

Edits:

- `apps/mobile/native/Cargo.toml`: time-core path `../../shared/core`.
- `apps/mobile/native/package.json`: the store-client link becomes
  `link:../../../../store/modules/client-ts`.
- `apps/mobile/native/tsconfig.json`: extend
  `../../shared/tooling/tsconfig.base.json`.
- No change needed in `ubrn.config.yaml`, `android/CMakeLists.txt` or
  `android/build.gradle` (`jsRootDir = file("../src/")`). Their paths stay
  inside the package. Check `.cargo/config.toml` for absolute or climbing
  paths.
- `pnpm-workspace.yaml`: replace `apps/core-native` with `apps/mobile/native`.
  The package name `@skkil-time/core-native` stays, so mobile's imports
  don't change.
- `apps/mobile/scripts/run-android.sh`: change `pnpm --dir ../core-native` to
  `pnpm --dir native`.
- Stop mobile's own tools from sweeping into the nested package:
  - `apps/mobile/tsconfig.json`: add `"exclude": ["native"]`
  - `apps/mobile/eslint.config.mjs`: add `native/**` to `ignores`
  - `apps/mobile/.prettierignore`: add `native/`
  - `apps/mobile/metro.config.js`: add a `resolver.blockList` for
    `native/target`, `native/android/build` and `native/android/.cxx`, so
    Metro doesn't crawl Rust and Gradle output
  - vitest already includes only `src/**`
- Rebuild from clean:
  - `pnpm --dir apps/mobile/native build:android`
  - `npx expo prebuild --platform android --clean`
- `skkil.yml`:
  - the `core-native` CI task becomes `mobile-native` with
    `dir: apps/mobile/native`
  - the `mobile` task's `depends_on` follows the rename
  - the NDK hint mentions `apps/mobile/native`
- Docs: change the core-native paths in `apps/mobile/README.md` ("Native
  core" section), `AGENTS.md` and the decision record.

Verify:

- In `apps/mobile/native`:
  - `cargo clippy --all-targets -- -D warnings`
  - `cargo test`
  - `pnpm test`
  - `pnpm check:ios`
  - `pnpm check:generated`: the committed bindings must not change
- In `apps/mobile`:
  - `pnpm compile && pnpm lint && pnpm test`
  - `npx expo-doctor`
  - `npx expo export --platform android --platform ios`
  - `(cd android && ./gradlew assembleDebug)`
- On the emulator: sign in, add a task, see it sync to web

Commit: `refactor: mobile owns its native core (apps/mobile/native)`

## Step 5: `apps/shared/domain` → `apps/shared/rules`

Edits:

- Package name: change `@skkil-time/domain` to `@skkil-time/rules` in its
  `package.json` and in the dependents (`apps/shared/app/package.json`,
  `apps/mobile/package.json`). Run `pnpm install` to update the lockfile.
- Imports: about 76 files import `@skkil-time/domain/...`. Rewrite them
  mechanically:
  `grep -rl "@skkil-time/domain" apps --include='*.ts' --include='*.tsx' | xargs sed -i 's#@skkil-time/domain#@skkil-time/rules#g'`
  Exclude `node_modules`.
- `repeat-phrases.json` path, read by every backend's tests:
  - `apps/shared/core/src/recurrence/mod.rs`: `../../../rules/src/quick-add/repeat-phrases.json`
  - `apps/server/src/test/kotlin/.../recurrence/domain/RecurrenceTest.kt`: `../shared/rules/...`
  - `apps/server/build.gradle.kts`: the test input `../shared/rules/src/quick-add/repeat-phrases.json`
- `skkil.yml`: `shared-domain` becomes `shared-rules` with
  `dir: apps/shared/rules`.
- Docs: change `apps/shared/domain` and "domain" package mentions to rules in
  `AGENTS.md` (the "Change once" paragraph, Quick Add, repo structure),
  `apps/shared/README.md`, `apps/mobile/README.md` and `BACKLOG.md`.

Verify:

- `pnpm lint && pnpm compile && pnpm test` at the root
- `cargo test` in `apps/shared/core`
- `./gradlew test` in `apps/server` (`RecurrenceTest` must run against the
  moved file, not a cached result)

Commit: `refactor: rename the shared domain package to rules`

## Step 6: compose stack → `infra/compose.yaml`

Moves:

- `apps/server/compose.yaml` → `infra/compose.yaml`

Edits:

- `infra/compose.yaml`: the store service build path becomes
  `${STORE_DIR:-../../store}/modules/service`, relative to `infra/`. Keep
  `name: skkil-time`, so the existing Postgres volume and the local data in
  it carry over.
- `skkil.yml`: the `services` dev process gets `dir: infra`.
- `apps/server/conformance/run.sh`: derive `repo` from `$server`, and run
  every `docker compose` call as
  `docker compose -f "$repo/infra/compose.yaml" ...` instead of `cd "$server"`.
  `STORE_DIR` keeps working as it does today.
- `apps/server/README.md`: the local setup command becomes
  `docker compose -f ../../infra/compose.yaml up -d --build`, or run
  `docker compose up -d --build` from `infra/`.
- Docs: change the compose mentions in `AGENTS.md` (server section, "`docker
  compose up -d`…") and `docs/deployment.md`.
- Unchanged: the web nginx config, `security-headers.conf`,
  `docker-entrypoint.sh` and both Dockerfiles stay with their apps.

Verify:

- `docker compose -f infra/compose.yaml config`
- `skkil dev` brings up Postgres, auth and store, and the server connects
- `./conformance/run.sh -runs 1` in `apps/server`

Commit: `build: move the local compose stack to infra/`

## Step 7: docs sweep and final check

Edits:

- `AGENTS.md`: rewrite "Repository structure" for the new tree and add the
  rules from the top of this plan. Search the whole file for `apps/core`,
  `core-wasm`, `core-native`, `shared/domain` and `compose.yaml`.
- Search for the same five strings in `README.md`, `apps/*/README.md`,
  `apps/shared/README.md`, `docs/`, `BACKLOG.md` and `.design/DESIGN.md`.
- `.gitignore`: confirm that `target/`, `pkg/` and the native build outputs
  are still ignored at their new paths.
- Stale worktrees: `.claude/worktrees/` holds agent worktrees with the old
  layout. List them with `git worktree list` and ask the user before
  removing any.

Verify:

- `skkil doctor`
- Full `skkil ci`, which must match the baseline from "Before starting"
- `skkil dev` smoke test: web loads and signs in, desktop opens its existing
  database, mobile runs on the emulator

Commit: `docs: describe the new repo layout`

## Rollback

Each step is one commit. Revert in reverse order, delete `node_modules` and
reinstall, and rebuild the wasm package and the Android native libraries.
Docker builds need the old build context (`apps`) again after reverting
step 1.

## Out of scope (possible follow-ups)

- Renaming the moved crates and packages (`time-core-wasm`,
  `@skkil-time/core-wasm`, `time-core-native`, `@skkil-time/core-native`).
  Keeping the names leaves imports untouched during the move. They could
  become `web-engine` and `mobile-native` later if the old names start to
  confuse.
- A root Cargo workspace, for the feature-unification reason above.
- The server's Kotlin copy of the domain rules. It's the biggest structural
  duplication left, but folder layout doesn't change it.

## Estimate

About half a day of mechanical work in 7 commits. Most of the risk is in step
4 (native caches and generated bindings) and step 1 (Docker context and
mobile caches).
