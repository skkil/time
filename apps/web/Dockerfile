# syntax=docker/dockerfile:1
# Build with apps/ as the context and the pinned store checkout as a named context:
#   docker build -f apps/web/Dockerfile --build-context store=../store apps
FROM rust:1-slim-bookworm AS wasm
RUN apt-get update && apt-get install -y --no-install-recommends clang \
 && rm -rf /var/lib/apt/lists/* \
 && rustup target add wasm32-unknown-unknown
WORKDIR /work/time/apps/core-wasm
COPY core-wasm/Cargo.toml ./
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    cargo install wasm-bindgen-cli --locked --version "$(sed -n 's/^wasm-bindgen = "=\(.*\)"$/\1/p' Cargo.toml)"
COPY --from=store modules/core/Cargo.toml modules/core/Cargo.lock /work/store/modules/core/
COPY --from=store modules/core/crates /work/store/modules/core/crates
COPY --from=store modules/core/tools /work/store/modules/core/tools
COPY core /work/time/apps/core
COPY core-wasm /work/time/apps/core-wasm
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/work/time/apps/core-wasm/target \
    sh scripts/build.sh

FROM node:22-alpine AS store-client
RUN corepack enable
WORKDIR /work/store/modules/client-ts
COPY --from=store modules/client-ts/package.json modules/client-ts/pnpm-lock.yaml modules/client-ts/tsconfig.json modules/client-ts/tsconfig.build.json ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
COPY --from=store modules/client-ts/src src
RUN pnpm build

FROM node:22-alpine AS build
RUN corepack enable
COPY --from=store-client /work/store/modules/client-ts /work/store/modules/client-ts
WORKDIR /work/time/apps
COPY . .
COPY --from=wasm /work/time/apps/core-wasm/pkg core-wasm/pkg
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @skkil-time/web...
RUN VITE_API_URL=runtime VITE_AUTH_AUTHORITY=runtime VITE_AUTH_CLIENT_ID=runtime \
    pnpm --filter @skkil-time/web build

FROM nginxinc/nginx-unprivileged:1.29-alpine
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY web/security-headers.conf /etc/nginx/security-headers.conf
COPY --from=build /work/time/apps/web/dist /usr/share/nginx/html
COPY --chmod=755 web/docker-entrypoint.sh /docker-entrypoint-time.sh
USER root
RUN chown 101:101 /usr/share/nginx/html/config.js
USER 101
EXPOSE 8080
ENTRYPOINT ["/docker-entrypoint-time.sh"]
