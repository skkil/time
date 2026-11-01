# shared

TypeScript packages the apps share. They are source-only workspace packages
(`workspace:*`): no build step, consumed directly by Vite, Metro and Vitest.

| Package                             | Used by      | Holds                                                                                                                 |
| ----------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------- |
| `contract` (`@skkil-time/contract`) | all          | `bindings.ts`, generated from the Rust commands. The types every app agrees on                                        |
| `app` (`@skkil-time/app`)           | desktop, web | The whole React UI behind two ports: `Backend` (the commands) and `Platform` (windows, URLs, account, feature flags)  |
| `domain` (`@skkil-time/domain`)     | all          | Platform-free rules: dates, the day plan, due dates, the timer, the Quick Add parser                                  |
| `tokens` (`@skkil-time/tokens`)     | all          | Colours, project colours and the sky as TypeScript; `pnpm generate` writes `tokens.css`                               |
| `api` (`@skkil-time/api`)           | web, mobile  | `openapi.json` from the server, generated types and a typed `fetch` client                                            |
| `remote` (`@skkil-time/remote`)     | web, mobile  | The `Backend` over HTTP. It must `satisfies Backend`, so `tsc` fails when Kotlin and Rust types drift                 |
| `local` (`@skkil-time/local`)       | web, mobile  | The `Backend` over a local time-core engine: mutations and reads by contract name, device-only commands from the host |
| `auth` (`@skkil-time/auth`)         | web, mobile  | Provider-neutral sign-in interface; `auth/web` implements it with `oidc-client-ts`                                    |
| `tooling` (`@skkil-time/tooling`)   | all          | The shared ESLint, Prettier and TypeScript configs                                                                    |

Where a change lands:

- A UI change in `app` reaches desktop and web.
- A rule in `domain` reaches every app.
- A colour in `tokens/src/colors.ts` reaches every app after `pnpm generate`.
- A new desktop command means a Rust command, a Kotlin endpoint and a line in
  `remote`. The type check tells you which is missing.

Inside a package, import siblings with `#name` (Node subpath imports), not
`../`. The `app` package uses `@/`, which each consuming app maps to
`apps/shared/app/src`.
