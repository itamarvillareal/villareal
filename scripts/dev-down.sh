#!/usr/bin/env bash
# Para containers e encerra o processo SSH que faz forward na porta 3308.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE_ENV="${COMPOSE_ENV_FILE:-$REPO_ROOT/.env.docker}"

TUNNEL_LOCAL_PORT="${TUNNEL_LOCAL_PORT:-3308}"
SSH_TARGET="${SSH_TARGET:-root@161.97.175.73}"

echo "Parando containers..."
if [[ -f "$COMPOSE_ENV" ]]; then
  docker compose --env-file "$COMPOSE_ENV" down
else
  docker compose down
fi

echo "Encerrando túnel na porta $TUNNEL_LOCAL_PORT (se existir)..."
# Lista PIDs que escutam na porta (macOS lsof)
PIDS=$(lsof -nP -iTCP:"$TUNNEL_LOCAL_PORT" -sTCP:LISTEN -t 2>/dev/null || true)
if [[ -n "${PIDS:-}" ]]; then
  for pid in $PIDS; do
    kill "$pid" 2>/dev/null || true
  done
  echo "Túnel finalizado."
else
  echo "Nenhum listener em $TUNNEL_LOCAL_PORT."
fi
