#!/usr/bin/env bash
# Instala o agente local (LaunchAgent) — pode rodar de qualquer pasta.
set -euo pipefail

HELPER_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$HELPER_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js não encontrado. Instale em https://nodejs.org e execute novamente:"
  echo "  bash \"$HELPER_DIR/install.sh\""
  exit 1
fi

echo "Instalando agente local Villa Real..."
exec node scripts/install-launchagent.mjs
