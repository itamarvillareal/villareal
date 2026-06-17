#!/usr/bin/env bash
# @deprecated — use start-import-real-cadastro-completo.sh
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export FRESH="${FRESH:-0}"
export RETOMAR="${RETOMAR:-0}"
exec bash "$ROOT/scripts/start-import-real-cadastro-completo.sh"
