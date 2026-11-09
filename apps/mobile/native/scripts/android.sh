#!/usr/bin/env bash
# Builds time-core-native for Android (arm64-v8a, x86_64) with cargo-ndk,
# copies the static libraries into android/src/main/jniLibs and regenerates
# the bindings and Turbo Module glue.
set -euo pipefail
cd "$(dirname "$0")/.."

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export ANDROID_NDK_HOME="${ANDROID_NDK_HOME:-$ANDROID_HOME/ndk/30.0.14904198}"

if ! command -v cargo-ndk >/dev/null; then
  echo "cargo-ndk is missing: cargo install cargo-ndk" >&2
  exit 1
fi
if [ ! -d "$ANDROID_NDK_HOME" ]; then
  echo "No NDK at $ANDROID_NDK_HOME; install it or set ANDROID_NDK_HOME." >&2
  exit 1
fi

exec pnpm exec ubrn build android --config ubrn.config.yaml --and-generate --release "$@"
