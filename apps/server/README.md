# server

The skkil time API: Kotlin, Spring Boot 4.1, Java 25, Postgres. It is an OAuth2
resource server only. Any OpenID Connect provider issues the tokens.

## Store checkout

The server depends on [store](../../../store) at the tag in the root
`STORE_VERSION`. Gradle includes `modules/adapter-jvm` of that checkout as a
composite build, Compose builds its store service, and a test compares the
copied SQL with it. The checkout is found at `STORE_DIR` (Gradle property
`storeDir`), default `../store` next to the time repo:

```bash
git clone --branch "$(cat STORE_VERSION)" <store repo URL> ../store   # from the time repo root
STORE_DIR=/path/to/store ./gradlew test                                # or point at another checkout
```

CI does the same clone before `skkil ci`; `skkil doctor` checks the checkout
is at the pinned tag.

## Run locally

```bash
docker compose -f ../../infra/compose.yaml up -d --build   # Postgres on 5433, mock OIDC issuer on 8090, store service on 8091
./gradlew bootRun                                          # API on 8080, health and metrics on 8081 (dev profile)
```

`bootRun` uses the `dev` profile, which signs sync tokens with a key made at
startup; the store service reads it from `/api/v1/sync/jwks.json` (restart the
store container after restarting the server if pulls answer `unauthenticated`).

Sign in from the web app or the desktop (client `time-desktop`, PKCE, loopback redirect on any
`127.0.0.1` port) with any username. The mock issuer accepts it and stamps the `time-api` audience.
Its login page (`infra/mock-login.html`) also puts `name` (the username unless given) and `email`
(`<username>@example.com` unless given) into the ID and access tokens. Client-credentials tokens
are unchanged: `sub` is the client id.

## Check

```bash
./gradlew spotlessApply test   # Testcontainers starts its own Postgres
./gradlew openApi              # rewrite ../shared/client/src/server/openapi.json after API changes
```

`OpenApiDocumentTest` fails when the committed OpenAPI document is stale. After
`./gradlew openApi`, run `pnpm generate:api` and `pnpm exec tsc -b` in
`apps/shared/client`. That type check proves the Kotlin
types still match the Rust contract the UI is built on.

`./conformance/run.sh` builds store's conformance suite from the checkout and
runs it with `conformance/profile.json` (time's mutations) against a fresh
stack, or against a running one with `REUSE_STACK=1`. It needs Go and the
ports above free.

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | `jdbc:postgresql://localhost:5433/time` | JDBC URL |
| `DATABASE_USERNAME` / `DATABASE_PASSWORD` | `time` / `time` | Database login |
| `DATABASE_POOL_SIZE` | `10` | Hikari pool size |
| `AUTH_ISSUER_URI` | `http://localhost:8090/default` | OIDC issuer; JWKS is discovered from it |
| `AUTH_AUDIENCE` | `time-api` | Required `aud` claim |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` | Comma-separated web origins |
| `RATE_LIMIT_PER_MINUTE` | `600` | Requests per client address per minute |
| `PORT` / `MANAGEMENT_PORT` | `8080` / `8081` | API and actuator ports |
| `PUSH_REMINDERS` | `true` | Run the reminder job (every 20 s; one instance sends at a time) |
| `EXPO_ACCESS_TOKEN` | unset | Bearer token for Expo push, when the Expo project requires one |
| `WEB_PUSH_PUBLIC_KEY` / `WEB_PUSH_PRIVATE_KEY` | unset | VAPID keys, base64url (`npx web-push generate-vapid-keys`); web push is off without them |
| `WEB_PUSH_SUBJECT` | unset | VAPID contact, `mailto:` or `https:` URL; required for web push |
| `STORE_URL` | `http://localhost:8091` | Store service base URL handed to devices with a sync token |
| `STORE_TOKEN_PRIVATE_KEY_PEM` / `STORE_TOKEN_PUBLIC_KEY_PEM` | unset | ES256 key pair (PKCS#8 / SPKI PEM) for sync tokens; required outside the `dev` profile |
| `STORE_BASELINE_ON_START` | `true` | Run `BaselineJob` when the server is ready (off in tests, which call it directly) |
| `STORE_DIR` | `../store` (repo root) | Store checkout for the build, Compose and conformance |
| `SPRING_PROFILES_ACTIVE` | `prod` in the image | `prod` logs JSON (ECS); `dev` (bootRun, tests) makes its own token key |

Probes: `GET /livez` and `GET /readyz` on the API port. Prometheus metrics are at
`/actuator/prometheus` on the management port, which must stay private.

## Code layout

Package by feature, layered inside. Each file holds one top-level class and is
named after it. Under `src/main/kotlin/com/skkil/time/`:

| Package | Holds |
|---|---|
| `config/` | `@Configuration` and properties: `AppProperties`, `OpenApiConfig` (with `KotlinNullability`), `WebConfig`, `ReminderSchedulingConfig` |
| `security/` | `SecurityConfig`, `CallerResolver`, `AccountService` (provisioning from `(issuer, subject)`), header constants |
| `common/error/` | `DomainException`, `ErrorKind`, `ensure`/`orNotFound` helpers, `ProblemHandler` |
| `common/web/` | `Caller`, `RateLimitFilter` |
| `common/clock/` | `MutationClock` (system, fixed, or from a mutation's HLC) and `Hlc` |
| `common/id/` | `IdGenerator`, `UuidV7Generator` (the default), `UuidV5` and `NaturalIds` for natural-key rows |
| `common/persistence/` | `ResultSet` helpers |
| `common/text/` | Text validation helpers |
| `features/<domain>/api/` | `@RestController` classes and request bodies used only at the HTTP edge |
| `features/<domain>/service/` | `@Service` classes: rules and transactions |
| `features/<domain>/repository/` | `JdbcClient` queries, where they are kept apart from the service |
| `features/<domain>/domain/` | Models, enums and pure rules shared by service and API |

`features/mutations/` holds the write-command registry: `MutationDispatcher` (what store's Push handler calls),
`MutationRegistry` and one `MutationSet` per feature in `service/`. `MutationCoverageTest` keeps it equal to the
`mutations` of `apps/shared/client/src/types/commands.json`.

`features/sync/` makes the server a store product: `api/` (Push and sync tokens), `service/` (`ServerWrites`,
`PushService`, `DispatchedMutation`, `SyncTokenService`, `BaselineService`), `domain/` (`BASELINE_TABLES`), `job/`
(`BaselineJob`) and `web/` (`ServerWriteAspect`, `@OwnWritePath`). `config/StoreConfig` wires adapter-jvm.

A feature only has the layers it needs. A few have their own: `changes/web/`
(the write-tracking filter), `realtime/websocket/`, `notifications/push/` (the
Expo and Web Push senders), `notifications/job/` (`ReminderJob`) and `sync/job/` (`BaselineJob`).

Tests in `src/test/kotlin` sit in the same packages as what they test; most are
HTTP-level and sit at the feature root. `support/` holds the test base classes.
Flyway migrations are in `src/main/resources/db/migration`. Never edit a
shipped one; add a new one.

## Ids, clock and mutations

Synced rows are keyed by `uuid` (migration `V8__uuid_ids.sql` turned every bigint id and foreign key into UUIDv7,
ordered by the old id, and gave the composite-key tables an `id` too). `app_user.id` stays bigint; its
`scope_id` is the store scope. Push devices keep bigint ids.

- **Clock.** A write reads "now" only through `Caller.now()`/`today()` (or an injected `MutationClock` outside a
  request). A test fails on any `Instant.now()`-style call in `src/main`.
- **Ids.** New rows take `caller.nextId()`; the request's `IdGenerator` is the `UuidV7Generator` bean. Create
  methods also take an explicit `id: UUID? = null`.
- **Taken ids.** Inserting an id that already exists is a `conflict` ("That id is already taken."), whether the
  row is in the same account or another. Store already applies each `(client, mutation)` once, so a clash means a
  different write owns the id; refusing it never merges two creates or reveals another account's row.
- **Mutations.** `MutationDispatcher.dispatch(caller, name, args, clock, idSource)` runs one contract write command
  (`createTask`, `moveTask`, ...) in a transaction (or the one already open), with `args` keyed by the contract's
  parameter names. It sets the caller's clock and id source for that operation only. A constraint the rules missed
  becomes a `conflict`. Booleans in the arguments may also be `1`/`0` (`SqliteBooleans`), at any depth, as in
  time-core. `MutationCoverageTest` keeps the registry equal to the `mutations` and `syncMutations` of `commands.json`, and
  `MutationVectorsTest` replays `apps/shared/client/src/types/mutation-vectors.json`, which `time-core` replays too.
- **importLocal.** The one sync-only mutation: an unbound device's whole database on its first sign-in, or a web
  backup being restored (`features/data/service/LocalImportService`, tables in `LOCAL_TABLES`). It keeps the
  device's ids, re-keys natural-key rows for the scope, refuses another account's ids and references, and merges a
  row into the account's row with the same natural key (a group's name, a quarter's start, an external id). The
  root `AGENTS.md` ("First sign-in" under "Sync") sums up the rules.
- **Natural keys.** Rows identified by a natural key (upserts of setting, project canvas, week, day, task dependency,
  record phase, running timer, habit log, user preference, and the rituals) take `NaturalIds` (`common/id/`):
  `UuidV5(scopeId, "<table>/<key parts joined by />")`, such as `week/2026-11-02`, and draw no id. Two devices
  creating the same week offline make one row. `NaturalIdsTest` checks them against
  `apps/shared/client/src/types/natural-keys.json`, as the desktop does. The full list is "Natural keys" under "Sync"
  in the root `AGENTS.md`; migration `V15` re-keyed existing rows (and would carry any foreign key to them along).
- **Seeded rows.** Rows the app creates on its own take their natural-key id: the default rituals are
  `ritual/<kind>` (`morning`, `evening`, `wind_down`, `session`, `weekly`). The server seeds them once, as a server
  write, when the account is created (and again after Delete all data or a restore); a device seeding before its
  first sync must use the same namespace and names, so both produce the same ids. Migration `V11` re-keyed existing
  rituals the same way.
- **Order.** Priorities and outcomes sort by `position` (one more than the last in their quarter or week), not by id.

## Sync through store

The contract is `docs/protocol.md` in the store repo; how time maps onto it is "Sync" in the root `AGENTS.md`.

- **SQL.** `V9__store_v1.sql`, `V10__store_v2.sql`, `V14__store_v3.sql` and `V16__store_v4.sql` are store's migrations byte for byte under
  a header naming the tag each was copied at (`StoreMigrationsTest` compares them with the checkout and checks no tag
  is newer than `STORE_VERSION`). The server calls only store's documented functions, through adapter-jvm's
  `StoreWritePath`, never the `store_*` tables or `store.*` settings. `V13` registers every user table keyed by a uuid; row
  images leave out `user_id`, and `task.reminded_for` (the reminder job's bookkeeping; devices keep their own).
  Not synced: `app_user`, `user_identity`, `push_device`, `realtime_ticket`. A write to a registered table outside
  the write path fails with SQLSTATE `55000`; a migration that rewrites synced rows must `SET LOCAL store.bypass = on`.
- **REST writes.** `ServerWriteAspect` wraps every `@PostMapping`/`@PutMapping`/`@PatchMapping`/`@DeleteMapping`
  of a `@RestController` that takes a `Caller` in `ServerWrites.run(caller.scopeId)`: one transaction with
  `store_begin_server(scope)` before the endpoint and `store_end_if_changed()` after, so services join it and a
  failure rolls back rows and log together. A write that changed no synced row (or only excluded columns, such as
  `task.reminded_for`) closes without a version; one made while a mutation is open (`store_is_open()`) joins it. Endpoints that open the
  write path themselves (Push, account deletion) or write nothing synced (sync tokens, Undo capture) carry
  `@OwnWritePath`.
- **Background writers.** `ReminderJob` marks tasks reminded in one server write per owner. Provisioning seeds the
  rituals as a server write. Deleting the account logs every delete, then drops the scope with its clients and log
  (`store_drop_scope`).
- **Baseline.** Rows written before `V13`, or rewritten under `store.bypass` (`V15`), are not in the log, so a device
  pulling from version 0 would never see them. `BaselineJob` (`features/sync/job/`) starts when the server is ready
  (on a virtual thread, retrying every minute while accounts remain; `STORE_BASELINE_ON_START=false` turns it off) and
  gives every account without a `sync_baseline` row (`V17`) one server write that runs `store_capture_existing` over
  every registered table, filtered to the account, parents first (`BASELINE_TABLES` in `features/sync/domain/`; a test
  checks it against `store_table` and the foreign keys). Each account is its own transaction under
  `pg_try_advisory_xact_lock(BASELINE_LOCK_KEY, hashint8(user))`, so instances share the work and none baselines an
  account twice; the row records the version. New accounts are marked at provisioning with a `NULL` version, since
  every row they write is logged.
- **Restore.** `POST /api/v1/data/import` (`@OwnWritePath`) replaces the rows in one server write, then
  `BaselineService.restart` bumps the scope's epoch (`store_bump_epoch`), so every device resets and pulls from version
  0, and baselines it again, all in one transaction. Delete all data stays an ordinary logged write.
- **Push.** `POST /skkil.store.v1.PushService/Push` (Connect, binary or JSON, the API's bearer token) runs adapter-jvm's
  `PushHandler` for the caller's scope; each mutation goes to `MutationDispatcher` as the scope's owner, at
  `MutationClock.fromHlc(hlc)` (server time when `hlc` is 0), naming rows with `MutationContext.nextId()`. A
  `DomainException` is `REJECTED` with its message; anything else aborts the batch. When any mutation applied, the
  account's `data_version` moves and the realtime bus publishes topic `sync`, so REST clients refetch.
- **Sync tokens.** `POST /api/v1/sync/token` `{clientId}` answers `{token, expiresAt, storeUrl, pushUrl}` (ES256,
  `iss` `time`, 15 minutes). The client id is claimed for the caller's scope with `store_claim_client`; one already bound
  to another account is a `conflict`. `GET /api/v1/sync/jwks.json` (public) serves the key for `STORE_TOKEN_JWKS_URL`.
- **Undo.** `captureTasks` is a read returning the snapshot, the serde JSON of `time_core::undo::TaskSnapshot`:
  `{tasks: {table, columns, values: [[...]]}, created: [[id, createdAt]], copies: [rows of time_block, record_phase],
  dependencies: [[taskId, blockedById]], links: [[table, id, taskId]]}`. `restoreTasks(snapshot)` is a mutation that
  restores only columns this server has, as the caller, after checking every reference is the caller's. Dependencies
  and copied record phases without an `id` take their natural-key ids; other copied rows without one draw an id. Nothing is stored on the server.
