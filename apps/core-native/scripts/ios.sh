#!/usr/bin/env bash
# Builds time-core-native for iOS (device and Apple-silicon simulator),
# wraps it as build/TimeCoreFramework.xcframework and regenerates the
# bindings and Turbo Module glue. Needs macOS with Xcode; on Linux,
# `pnpm check:ios` type-checks the iOS targets instead.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ "$(uname)" != "Darwin" ] || ! command -v xcodebuild >/dev/null; then
  echo "iOS builds need macOS and Xcode. On Linux, run: pnpm check:ios" >&2
  exit 1
fi

exec pnpm exec ubrn build ios --config ubrn.config.yaml --and-generate --release "$@"
