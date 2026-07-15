#!/usr/bin/env bash
# Instala o agente local (LaunchAgent) — pode rodar de qualquer pasta.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/e-vilareal-local-helper"
exec node scripts/install-launchagent.mjs
