#!/bin/sh
# Builds the wasm module and its JS bindings into pkg/.
set -eu

cd "$(dirname "$0")/.."
wanted=$(sed -n 's/^wasm-bindgen = "=\(.*\)"$/\1/p' Cargo.toml)
found=$(wasm-bindgen --version 2>/dev/null | cut -d' ' -f2 || true)
if [ "$found" != "$wanted" ]; then
  echo "wasm-bindgen-cli $wanted is required (found ${found:-none}): cargo install wasm-bindgen-cli --version $wanted --locked" >&2
  exit 1
fi

cargo build --release --lib
rm -rf pkg
wasm-bindgen --target web --out-dir pkg target/wasm32-unknown-unknown/release/time_core_wasm.wasm
