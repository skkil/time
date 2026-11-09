#!/bin/sh
set -eu

here=$(cd "$(dirname "$0")" && pwd)
server=$(dirname "$here")
repo=$(dirname "$(dirname "$server")")
compose="$repo/infra/compose.yaml"
store=${STORE_DIR:-$server/../../../store}
bin=$server/build/conformance

(cd "$store/modules/conformance" && go build -o "$bin" ./cmd/conformance)

if [ "${REUSE_STACK:-0}" != 1 ]; then
  STORE_DIR=$store docker compose -f "$compose" up -d --build --wait postgres auth
  (cd "$server" && STORE_DIR=$store ./gradlew -q bootJar)
  SPRING_PROFILES_ACTIVE=dev java -jar "$server"/build/libs/time-server-*.jar > "$server/build/conformance-server.log" 2>&1 &
  pid=$!
  trap 'kill $pid 2>/dev/null || true; STORE_DIR=$store docker compose -f "$compose" stop store' EXIT
  until curl -fsS http://localhost:8080/readyz > /dev/null 2>&1; do sleep 1; done
  STORE_DIR=$store docker compose -f "$compose" up -d --build --wait store
fi

"$bin" \
  -push-url http://localhost:8080 \
  -store-url http://localhost:8091 \
  -token-cmd "$here/token.sh" \
  -profile "$here/profile.json" \
  -database-url postgres://time:time@localhost:5433/time \
  "$@"
