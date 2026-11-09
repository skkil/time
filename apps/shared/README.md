# shared

Code the apps share: time-core in Rust, and five TypeScript packages named by
role. "core" means only the Rust domain.

`core` (`time-core`) is a Rust crate, not a workspace package: the platform-free
domain (types, migrations, rules, queries, the mutation registry) that desktop's
`src-tauri`, web's wasm engine and mobile's native module depend on by path.

The TypeScript packages are source-only workspace packages (`workspace:*`): no
build step, consumed directly by Vite, Metro and Vitest.

| Package                         | Used by      | Holds                                                                                                                |
| ------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------- |
| `ui` (`@skkil-time/ui`)         | desktop, web | The whole React UI behind two ports: `Backend` (the commands) and `Platform` (windows, URLs, account, feature flags) |
| `design` (`@skkil-time/design`) | all          | Colours, project colours and the sky as TypeScript; `pnpm generate` writes `tokens.css`                              |
| `rules` (`@skkil-time/rules`)   | all          | Platform-free rules: dates, the day plan, due dates, the timer, the Quick Add parser                                 |
| `client` (`@skkil-time/client`) | all          | Talking to time-core and the server, one subpath per concern (below)                                                 |
| `config` (`@skkil-time/config`) | all          | The shared ESLint, Prettier and TypeScript configs                                                                   |

`client` subpaths:

| Import                               | Source         | Holds                                                                                                                                            |
| ------------------------------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@skkil-time/client/types`           | `src/types/`   | `bindings.ts`, generated from the Rust commands, plus `commands.json`, `natural-keys.json` and `mutation-vectors.json` that Rust and Kotlin read |
| `@skkil-time/client/server`          | `src/server/`  | `openapi.json` from the server, generated types, the typed `fetch` client and the `Backend` over HTTP, which must `satisfies Backend`            |
| `@skkil-time/client/server/realtime` | `src/server/`  | The realtime socket client                                                                                                                       |
| `@skkil-time/client/local`           | `src/local/`   | The `Backend` over a local time-core engine: mutations and reads by contract name, device-only commands from the host                            |
| `@skkil-time/client/sync`            | `src/sync/`    | Sync tokens (`createSyncAccount`, `syncTokens`), the account's store scope and push headers for `@skkil/store-client`                            |
| `@skkil-time/client/sign-in`, `/web` | `src/sign-in/` | Provider-neutral sign-in interface; `/web` implements it with `oidc-client-ts`                                                                   |

`pnpm generate` in `client` rewrites `src/server/schema.ts` from `openapi.json`
(`generate:api`) and `src/local/catalog.ts` from the types (`generate:catalog`);
`pnpm check:generated` fails when either is stale.

Where a change lands:

- A UI change in `ui` reaches desktop and web.
- A rule in `rules` reaches every app.
- A colour in `design/src/colors.ts` reaches every app after `pnpm generate`.
- A new command means a time-core function with its registry entry, the Tauri
  wrapper, a Kotlin endpoint and a line in `client/src/server`. The type check
  tells you which is missing.

Inside a package, import siblings with `#name` (Node subpath imports), not
`../`; in `client` that is `#server/api`, `#types/bindings` and so on. The `ui`
package uses `@/`, which each consuming app maps to `apps/shared/ui/src`.
