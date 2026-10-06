#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd -- "$(dirname -- "$0")/.." && pwd)"
LOCAL_TOOLCHAIN_ROOT="$(dirname -- "$PROJECT_ROOT")"
if [[ -x "$LOCAL_TOOLCHAIN_ROOT/.rust-agent/bin/rustc" ]]; then
  export PATH="$LOCAL_TOOLCHAIN_ROOT/.rust-agent/bin:$PATH"
  export RUSTC="$LOCAL_TOOLCHAIN_ROOT/.rust-agent/bin/rustc"
  export CARGO_HOME="$LOCAL_TOOLCHAIN_ROOT/.cargo-agent"
fi
if [[ -z "${NETWORK_AGENT_ENV_FILE:-}" ]]; then
  if [[ -f "$PROJECT_ROOT/.env" ]]; then
    export NETWORK_AGENT_ENV_FILE="$PROJECT_ROOT/.env"
  else
    export NETWORK_AGENT_ENV_FILE="$LOCAL_TOOLCHAIN_ROOT/.env"
  fi
fi
export NETWORK_AGENT_NODE="${NETWORK_AGENT_NODE:-$(command -v node)}"
export CARGO_PROFILE_DEV_DEBUG="${CARGO_PROFILE_DEV_DEBUG:-0}"
export CARGO_PROFILE_DEV_SPLIT_DEBUGINFO="${CARGO_PROFILE_DEV_SPLIT_DEBUGINFO:-off}"
export CARGO_PROFILE_DEV_INCREMENTAL="${CARGO_PROFILE_DEV_INCREMENTAL:-false}"
export CARGO_BUILD_JOBS="${CARGO_BUILD_JOBS:-4}"
cd "$PROJECT_ROOT"
exec npm start -- --no-watch "$@"
