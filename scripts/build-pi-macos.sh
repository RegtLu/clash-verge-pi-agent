#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd -- "$(dirname -- "$0")/.." && pwd)"
LOCAL_TOOLCHAIN_ROOT="$(dirname -- "$PROJECT_ROOT")"
if [[ -x "$LOCAL_TOOLCHAIN_ROOT/.rust-agent/bin/rustc" ]]; then
  export PATH="$LOCAL_TOOLCHAIN_ROOT/.rust-agent/bin:$PATH"
  export RUSTC="$LOCAL_TOOLCHAIN_ROOT/.rust-agent/bin/rustc"
  export CARGO_HOME="$LOCAL_TOOLCHAIN_ROOT/.cargo-agent"
fi
cd "$PROJECT_ROOT"
PI_TARGET="${1:-$(rustc --print host-tuple)}"
export TAURI_SIGNING_PRIVATE_KEY="${TAURI_SIGNING_PRIVATE_KEY:-$LOCAL_TOOLCHAIN_ROOT/.release-signing/clash-verge-pi-agent.key}"
if [[ ! -f "$TAURI_SIGNING_PRIVATE_KEY" ]]; then
  echo 'Set TAURI_SIGNING_PRIVATE_KEY to the updater private-key file.' >&2
  exit 1
fi
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="${TAURI_SIGNING_PRIVATE_KEY_PASSWORD:-}"
export CARGO_BUILD_JOBS="${CARGO_BUILD_JOBS:-4}"
export CARGO_PROFILE_RELEASE_DEBUG=0
export CARGO_PROFILE_RELEASE_SPLIT_DEBUGINFO=off
export HUSKY=0
npm run agent:setup
npm run prebuild -- "$PI_TARGET"
npm run agent:runtime -- "$PI_TARGET"
exec npm run tauri -- build --target "$PI_TARGET" --ci
