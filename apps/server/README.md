# server

The skkil time API: Kotlin, Spring Boot 4.1, Java 25, Postgres. It is an OAuth2
resource server only. Any OpenID Connect provider issues the tokens.

## Run locally

```bash
docker compose up -d     # Postgres on 5433, mock OIDC issuer on 8090
./gradlew bootRun        # API on 8080, health and metrics on 8081
```

Sign in from the web app with any username. The mock issuer accepts it and
stamps the `time-api` audience.

## Check

```bash
./gradlew spotlessApply test   # Testcontainers starts its own Postgres
./gradlew openApi              # rewrite ../shared/api/openapi.json after API changes
```

`OpenApiDocumentTest` fails when the committed OpenAPI document is stale. After
`./gradlew openApi`, run `pnpm generate` in `apps/shared/api` and
`pnpm exec tsc -b` in `apps/shared/remote`. That type check proves the Kotlin
types still match the Rust contract the UI is built on.

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
| `SPRING_PROFILES_ACTIVE` | `prod` in the image | `prod` logs JSON (ECS) |

Probes: `GET /livez` and `GET /readyz` on the API port. Prometheus metrics are at
`/actuator/prometheus` on the management port, which must stay private.

## Layout

- `common/`: caller and time zone, errors as problem details, settings, OpenAPI
  setup, rate limiting.
- `auth/`: security, user provisioning from `(issuer, subject)`.
- `features/<domain>/`: models, repository or service, controller, one per
  desktop feature.
- `src/main/resources/db/migration`: Flyway migrations. Never edit a shipped
  one; add a new one.
