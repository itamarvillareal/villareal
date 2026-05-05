#!/usr/bin/env bash
# Aplica scripts/sql/corrigir-mojibake-planilha-utf8.sql no MySQL alcançável em host.docker.internal:3308
# (túnel SSH local → VPS). Credenciais em .env.docker (VILLAREAL_COMPOSE_JDBC_*).
#
# Uso manual: ./scripts/db-corrigir-mojibake-docker.sh
# Ou: Command Palette → Tasks: Run Task → «Villareal: DB — corrigir mojibake (Docker + túnel)»
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/.env.docker}"
SQL_FILE="$ROOT/scripts/sql/corrigir-mojibake-planilha-utf8.sql"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[erro] Falta $ENV_FILE — copie .env.docker.example para .env.docker" >&2
  exit 1
fi
if [[ ! -f "$SQL_FILE" ]]; then
  echo "[erro] Falta $SQL_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

PASS="${VILLAREAL_COMPOSE_JDBC_PASSWORD:?Defina VILLAREAL_COMPOSE_JDBC_PASSWORD em .env.docker}"
USER="${VILLAREAL_COMPOSE_JDBC_USER:-villareal_remote}"
HOST="${VILLAREAL_MYSQL_TUNNEL_HOST:-host.docker.internal}"
PORT="${VILLAREAL_MYSQL_TUNNEL_PORT:-3308}"

echo "[info] Ligando a ${HOST}:${PORT} como ${USER} (cliente mysql dentro de container)…"
docker run --rm -i \
  -e MYSQL_PWD="$PASS" \
  -e VR_HOST="$HOST" \
  -e VR_PORT="$PORT" \
  -e VR_USER="$USER" \
  -v "$SQL_FILE:/tmp/fix.sql:ro" \
  mysql:8.0.36 \
  sh -c 'mysql --protocol=TCP -h"$VR_HOST" -P"$VR_PORT" -u"$VR_USER" --default-character-set=utf8mb4 vilareal < /tmp/fix.sql'

echo "[ok] Mojibake aplicado."
