# syntax=docker/dockerfile:1
# Build with apps/ as the context: docker build -f apps/web/Dockerfile apps
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /apps
COPY . .
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @skkil-time/web...
RUN VITE_API_URL=runtime VITE_AUTH_AUTHORITY=runtime VITE_AUTH_CLIENT_ID=runtime \
    pnpm --filter @skkil-time/web build

FROM nginxinc/nginx-unprivileged:1.29-alpine
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY web/security-headers.conf /etc/nginx/security-headers.conf
COPY --from=build /apps/web/dist /usr/share/nginx/html
COPY --chmod=755 web/docker-entrypoint.sh /docker-entrypoint-time.sh
USER root
RUN chown 101:101 /usr/share/nginx/html/config.js
USER 101
EXPOSE 8080
ENTRYPOINT ["/docker-entrypoint-time.sh"]
