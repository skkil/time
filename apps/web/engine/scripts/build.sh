#!/bin/sh
# Builds the wasm module and its JS bindings into pkg/, then shrinks the
# module with binaryen's wasm-opt -Oz when it is installed.
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
wasm-bindgen --target web --out-dir pkg "${CARGO_TARGET_DIR:-target}/wasm32-unknown-unknown/release/time_core_wasm.wasm"

module=pkg/time_core_wasm_bg.wasm
size() { wc -c < "$1" | tr -d ' '; }
before=$(size "$module")
if command -v wasm-opt > /dev/null; then
  wasm-opt -Oz --enable-bulk-memory --enable-nontrapping-float-to-int --enable-sign-ext \
    --enable-mutable-globals --enable-reference-types --enable-multivalue \
    "$module" -o "$module.opt"
  mv "$module.opt" "$module"
  if ! wasm-opt --all-features --print "$module" | awk '
    /^ \(table / { type = $NF; gsub(/\)/, "", type); types[$2] = type }
    /^ \(export "__wbindgen_externrefs" \(table / { target = $4; gsub(/\)/, "", target) }
    END { exit target == "" || types[target] != "externref" }
  '; then
    echo "wasm-opt $(wasm-opt --version) broke __wbindgen_externrefs (it no longer exports an externref table); use binaryen 133 or later" >&2
    exit 1
  fi
  echo "time_core_wasm_bg.wasm: $before bytes, $(size "$module") after wasm-opt -Oz"
else
  echo "time_core_wasm_bg.wasm: $before bytes (install binaryen for wasm-opt -Oz to shrink it)"
fi
