#!/usr/bin/env bash
# Corrige mojibake no cadastro de pessoas via MySQL (túnel local → VPS ou Docker).
#
# Uso:
#   ./scripts/db-corrigir-mojibake-docker.sh              # dry-run
#   ./scripts/db-corrigir-mojibake-docker.sh --aplicar
#
# Env (opcional): VILAREAL_MYSQL_HOST, VILAREAL_MYSQL_PORT (defeito 3308 = túnel VPS),
#                 VILAREAL_MYSQL_USER, VILAREAL_MYSQL_PASSWORD, VILAREAL_MYSQL_DATABASE
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB="$ROOT/e-vilareal-react-web"

export VILAREAL_MYSQL_HOST="${VILAREAL_MYSQL_HOST:-127.0.0.1}"
export VILAREAL_MYSQL_PORT="${VILAREAL_MYSQL_PORT:-3308}"
export VILAREAL_MYSQL_USER="${VILAREAL_MYSQL_USER:-root}"
export VILAREAL_MYSQL_PASSWORD="${VILAREAL_MYSQL_PASSWORD:-}"
export VILAREAL_MYSQL_DATABASE="${VILAREAL_MYSQL_DATABASE:-vilareal}"

if [[ -f "$ROOT/.env.docker" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env.docker"
  set +a
fi

ARGS=(--dry-run)
if [[ "${1:-}" == "--aplicar" ]]; then
  ARGS=(--aplicar)
fi

cd "$WEB"
echo "MySQL ${VILAREAL_MYSQL_HOST}:${VILAREAL_MYSQL_PORT}/${VILAREAL_MYSQL_DATABASE} — ${ARGS[*]}"
node scripts/corrigir-mojibake-cadastro-pessoas.mjs "${ARGS[@]}"
