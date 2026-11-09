# syntax=docker/dockerfile:1
# Build with the repo root as the context and the pinned store checkout as a named context:
#   docker build -f apps/web/Dockerfile --build-context store=../store .
FROM rust:1-slim-bookworm AS wasm
RUN apt-get update && apt-get install -y --no-install-recommends clang curl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && rustup target add wasm32-unknown-unknown
RUN version=133 arch=$(uname -m) \
 && case "$arch" in \
      x86_64) sum=2dc9c7813f5375db93d96ead4b78222fcc3e2677bbb832297af4797782a37489 ;; \
      aarch64) sum=89c07ea56faf38d0fbecf36ca8ec0721756716185f265b568e133d427f299bf8 ;; \
      *) echo "no binaryen build for $arch" >&2; exit 1 ;; \
    esac \
 && curl -fsSL -o /tmp/binaryen.tar.gz "https://github.com/WebAssembly/binaryen/releases/download/version_${version}/binaryen-version_${version}-${arch}-linux.tar.gz" \
 && echo "$sum  /tmp/binaryen.tar.gz" | sha256sum -c - \
 && tar xzf /tmp/binaryen.tar.gz -C /usr/local/bin --strip-components=2 "binaryen-version_${version}/bin/wasm-opt" \
 && rm /tmp/binaryen.tar.gz \
 && wasm-opt --version
WORKDIR /work/time/apps/web/engine
COPY apps/web/engine/Cargo.toml ./
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    cargo install wasm-bindgen-cli --locked --version "$(sed -n 's/^wasm-bindgen = "=\(.*\)"$/\1/p' Cargo.toml)"
COPY --from=store modules/core/Cargo.toml modules/core/Cargo.lock /work/store/modules/core/
COPY --from=store modules/core/crates /work/store/modules/core/crates
COPY --from=store modules/core/tools /work/store/modules/core/tools
COPY apps/shared/core /work/time/apps/shared/core
COPY apps/web/engine /work/time/apps/web/engine
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/work/time/apps/web/engine/target \
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
WORKDIR /work/time
COPY . .
COPY --from=wasm /work/time/apps/web/engine/pkg apps/web/engine/pkg
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @skkil-time/web...
RUN VITE_API_URL=runtime VITE_AUTH_AUTHORITY=runtime VITE_AUTH_CLIENT_ID=runtime \
    pnpm --filter @skkil-time/web build

FROM nginxinc/nginx-unprivileged:1.29-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/web/security-headers.conf /etc/nginx/security-headers.conf
COPY --from=build /work/time/apps/web/dist /usr/share/nginx/html
COPY --chmod=755 apps/web/docker-entrypoint.sh /docker-entrypoint-time.sh
USER root
RUN chown 101:101 /usr/share/nginx/html/config.js
USER 101
EXPOSE 8080
ENTRYPOINT ["/docker-entrypoint-time.sh"]
