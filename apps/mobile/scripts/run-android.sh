#!/bin/sh
set -eu

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
metro_port="${METRO_PORT:-8088}"
abi=$(adb shell getprop ro.product.cpu.abi | tr -d '\r')

pnpm --dir ../core-native build:android
pnpm exec expo prebuild --platform android --no-install
(cd android && ./gradlew installDebug -PreactNativeArchitectures="$abi" -PreactNativeDevServerPort="$metro_port")

for port in 8080 8090 8091 "$metro_port"; do
  adb reverse "tcp:$port" "tcp:$port"
done

pnpm exec expo start --localhost --port "$metro_port" &
metro=$!
trap 'kill "$metro" 2>/dev/null || true' EXIT INT TERM
until curl -fsS "http://localhost:$metro_port/status" > /dev/null 2>&1; do sleep 1; done

adb shell am start -n com.skkil.time/.MainActivity
wait "$metro"
