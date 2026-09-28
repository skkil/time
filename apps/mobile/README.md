# mobile

Expo SDK 58 app (Expo Router, React Native 0.88): Today, Inbox, projects,
Quick Add, focus timer, habits and account settings. It uses the same HTTP
backend as the web ([`apps/shared/remote`](../shared/remote)) and takes its
rules from [`apps/shared/domain`](../shared/domain) and its colours from
[`apps/shared/tokens`](../shared/tokens).

```bash
cp .env.example .env.local     # point at your server and OIDC provider
pnpm start                     # Expo dev server (needs a development build)
pnpm android / pnpm ios        # build and run a development build locally
pnpm compile && pnpm lint
```

Sign-in is OIDC Authorization Code + PKCE in the system browser with the
redirect `skkiltime://auth`; register that redirect with the provider. Tokens
are kept in the keychain (`expo-secure-store`).

## Release

```bash
eas build --profile production --platform all
eas submit --profile production
```

Set `EAS_PROJECT_ID` and the `EXPO_PUBLIC_*` variables in the EAS environment.
Icons come from `assets/icon.svg` at the repo root: `skkil assets generate`
renders the app icon, splash and favicon, and `scripts/android-icons.sh` the
Android adaptive layers. `EXPO_PUBLIC_LEGAL_URL` points Settings at the
privacy policy and terms.
