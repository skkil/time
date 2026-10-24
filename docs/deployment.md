# Deployment

How the server, web and mobile apps run in production on AWS, following
`../PLATFORM_PLAN.md`: one product section in `skkil.yml`, shared platform
layers owning the infrastructure. The desktop app ships as a Tauri bundle and
needs none of this.

## Pieces

| Piece | Artifact | Runs as |
|---|---|---|
| API | `apps/server/Dockerfile` (`docker build --build-context store=../store apps/server`, store checked out at `STORE_VERSION`) | Container on the shared app host or ECS; port 8080 public, 8081 private |
| Web | `apps/web/Dockerfile` (`docker build -f apps/web/Dockerfile apps`) | nginx container on port 8080, or the `dist/` folder on S3 + CloudFront |
| Database | Postgres 17 (RDS) | Flyway migrates on API start; one database `time` |
| Sign-in | Any OIDC provider (Auth0 per the platform plan) | One API, one SPA app, one native app |
| Mobile | EAS builds | App Store and Play Store |

## Sign-in provider

Create, per environment:

1. An **API** with identifier `time-api`, the audience the server checks.
2. A **single-page application** for the web: Authorization Code + PKCE,
   refresh token rotation on, allowed callback and logout URL
   `https://<web host>/`, allowed web origin `https://<web host>`.
3. A **native application** for mobile: Authorization Code + PKCE, refresh
   token rotation on, callback `skkiltime://auth`, logout `skkiltime://`.

Allow the scopes `openid profile email offline_access`. Moving to the skkil auth
service later only changes `AUTH_ISSUER_URI` on the server and the authority
and client ids in the web and mobile config. Users stay attached to their data
through `user_identity (issuer, subject)`; link the new issuer's subject to the
same `user_id` during the migration.

## API

Environment (secrets from Secrets Manager, the rest from SSM or `skkil.yml`):

```
DATABASE_URL=jdbc:postgresql://<rds host>:5432/time
DATABASE_USERNAME=time
DATABASE_PASSWORD=<secret>
AUTH_ISSUER_URI=https://<tenant>/            # must match the token's iss exactly
AUTH_AUDIENCE=time-api
CORS_ALLOWED_ORIGINS=https://<web host>
WEB_PUSH_PUBLIC_KEY=<vapid public>           # npx web-push generate-vapid-keys
WEB_PUSH_PRIVATE_KEY=<secret>
WEB_PUSH_SUBJECT=mailto:<contact>
EXPO_ACCESS_TOKEN=<secret, optional>
STORE_URL=https://<store service host>       # handed to devices with each sync token
STORE_TOKEN_PRIVATE_KEY_PEM=<secret>         # ES256, PKCS#8; ./gradlew syncTokenKeys in store's adapter-jvm
STORE_TOKEN_PUBLIC_KEY_PEM=<SPKI PEM>
```

The API refuses to start without the token keys (only the `dev` profile
makes its own). The store service (`modules/service` of the store checkout)
runs beside it on the same database with `STORE_TOKEN_ISSUER=time` and
`STORE_TOKEN_JWKS_URL=https://<api host>/api/v1/sync/jwks.json` (or the public
key PEM). Store's SQL needs the `pgcrypto` extension, which its migration
creates; grant the migrating role that right or create it beforehand.

- Health: `GET /readyz` (load balancer target), `GET /livez` (restart probe).
- Metrics: `GET :8081/actuator/prometheus`. Keep 8081 off the public listener.
- Logs: JSON (ECS format) on stdout with the `prod` profile, which the image
  sets.
- Shutdown is graceful (20 s), so rolling deploys drain requests.
- The built-in rate limit is a per-address safety net. Put WAF rate rules at
  the edge.
- Scaling: the API holds no state of its own; run two or more instances behind
  the load balancer. Realtime tickets live in Postgres, and
  change events reach every instance through Postgres `LISTEN/NOTIFY`.
- Websockets: `/api/v1/realtime` upgrades on the same port. Raise the load
  balancer's idle timeout above 30 s (the server pings every 25 s); no sticky
  sessions are needed. Behind RDS Proxy, `LISTEN` pins a connection, which is
  expected: one per instance.

## Web

Serve the container behind the same load balancer or CloudFront, with
`API_URL=https://<api host>`, `AUTH_AUTHORITY`, `AUTH_CLIENT_ID` and
`AUTH_AUDIENCE=time-api`. Hashed assets cache for a year; `index.html` and
`config.js` are never cached, so a deploy is live at once.

## Database

- RDS Postgres 17, `manage_master_user_password`, automated backups (7 to 35
  days) and point-in-time recovery.
- An app user owns the `time` database. Flyway runs on start under a lock, so
  parallel starts are safe.
- Never edit a shipped migration; add `V<n>__<what>.sql`.

## Mobile

1. `eas init` once, and put the project id in `EAS_PROJECT_ID`.
2. In the EAS environments, set `EXPO_PUBLIC_API_URL`,
   `EXPO_PUBLIC_AUTH_AUTHORITY`, `EXPO_PUBLIC_AUTH_CLIENT_ID`,
   `EXPO_PUBLIC_AUTH_AUDIENCE` and `EXPO_PUBLIC_LEGAL_URL`.
3. `eas build --profile production --platform all`, then `eas submit`.
4. Deep links use the `skkiltime://` scheme (for example
   `skkiltime://task/42`). For https universal links, add the production
   domain to `ios.associatedDomains` and an Android intent filter, and serve
   `apple-app-site-association` and `assetlinks.json` from the web host.
5. Store review needs a demo account on the production provider, the privacy
   policy URL, and the in-app account deletion (Settings → Delete account).

## `skkil.yml` platform sections

When the `skkil` CLI supports `resources`, `services`, `routes` and `auth`
(platform plan P3; today it rejects them), add:

```yaml
resources:
  db: { type: postgres }

services:
  server:
    build: { dir: apps/server, image: Dockerfile }
    port: 8080
    health: { port: 8080, path: /readyz }
    uses: [db]
    secrets: [DATABASE_PASSWORD]
    env:
      AUTH_AUDIENCE: time-api
      CORS_ALLOWED_ORIGINS: https://{host}
  web:
    build: { dir: apps, image: web/Dockerfile }
    port: 8080
    health: { port: 8080, path: /healthz }
    env:
      API_URL: https://{host}
      AUTH_AUDIENCE: time-api

routes:
  host: { prod: time.skkil.org, dev: time.dev.skkil.org }
  paths:
    - { path: /api/, to: server }
    - { path: /, to: web }

auth:
  api: { audience: time-api }
  clients:
    - { name: web, type: spa, callbacks: ["https://{host}/"] }
    - { name: mobile, type: native, callbacks: ["skkiltime://auth"] }
```

## Release checklist

- [ ] `skkil ci` green: server tests, OpenAPI drift check, type checks, lint,
      unit tests, builds.
- [ ] Provider apps and API created for the environment.
- [ ] Secrets set; `AUTH_ISSUER_URI` matches `iss` exactly, trailing slash
      included.
- [ ] `/readyz` healthy behind the load balancer; 8081 not public.
- [ ] Web origin in `CORS_ALLOWED_ORIGINS` and in the provider's allowed
      origins.
- [ ] VAPID keys set (web reminders) and EAS push credentials uploaded
      (APNs key, FCM v1) for mobile reminders.
- [ ] Privacy policy and terms published at `EXPO_PUBLIC_LEGAL_URL`.
