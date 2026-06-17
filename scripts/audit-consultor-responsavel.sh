#!/usr/bin/env bash
# Auditoria de consultor / usuario_responsavel_id — use contra PRODUÇÃO ou dump restaurado.
#
# NÃO trate o banco local (vilareal-db) como fonte de verdade para risco de backfill.
#
# --- Opção A: túnel SSH para MySQL na VPS (recomendado) ---
#   ssh -L 3308:127.0.0.1:3306 root@161.97.175.73 -N &
#   export VILAREAL_MYSQL_HOST=127.0.0.1
#   export VILAREAL_MYSQL_PORT=3308
#   export VILAREAL_MYSQL_USER=root
#   export VILAREAL_MYSQL_PASSWORD='…'   # ver /opt/villareal/villareal/.env.docker na VPS
#   ./scripts/audit-consultor-responsavel.sh
#
# --- Opção B: dump de produção restaurado localmente ---
#   ssh root@161.97.175.73 'mysqldump -u root -p vilareal processo usuarios' > /tmp/vilareal-prod-processo.sql
#   docker exec -i vilareal-db mysql -uroot -proot vilareal_audit < /tmp/vilareal-prod-processo.sql
#   export VILAREAL_MYSQL_HOST=127.0.0.1 VILAREAL_MYSQL_PORT=3307 VILAREAL_MYSQL_DATABASE=vilareal_audit
#   ./scripts/audit-consultor-responsavel.sh
#
# --- Opção C: direto na VPS ---
#   ssh root@161.97.175.73
#   mysql -u root -p vilareal < /opt/villareal/villareal/scripts/audit-consultor-responsavel.sql
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

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
  if [[ -n "${VILLAREAL_COMPOSE_JDBC_PASSWORD:-}" ]]; then
    export VILAREAL_MYSQL_PASSWORD="$VILLAREAL_COMPOSE_JDBC_PASSWORD"
  fi
fi

SQL_FILE="$ROOT/scripts/audit-consultor-responsavel.sql"
if [[ ! -f "$SQL_FILE" ]]; then
  echo "Arquivo SQL não encontrado: $SQL_FILE" >&2
  exit 1
fi

if command -v mysql >/dev/null 2>&1; then
  MYSQL=(mysql -h"$VILAREAL_MYSQL_HOST" -P"$VILAREAL_MYSQL_PORT" -u"$VILAREAL_MYSQL_USER")
  if [[ -n "$VILAREAL_MYSQL_PASSWORD" ]]; then
    MYSQL+=(-p"$VILAREAL_MYSQL_PASSWORD")
  fi
  MYSQL+=("$VILAREAL_MYSQL_DATABASE")
  echo "=== Auditoria consultor / responsável ==="
  echo "Host: ${VILAREAL_MYSQL_HOST}:${VILAREAL_MYSQL_PORT}/${VILAREAL_MYSQL_DATABASE}"
  echo ""
  "${MYSQL[@]}" <"$SQL_FILE"
  exit 0
fi

CONTAINER="${VILAREAL_MYSQL_CONTAINER:-vilareal-db}"
if docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "=== Auditoria consultor / responsável (docker exec $CONTAINER) ==="
  docker exec -i "$CONTAINER" mysql -u"$VILAREAL_MYSQL_USER" -p"${VILAREAL_MYSQL_PASSWORD:-root}" \
    "$VILAREAL_MYSQL_DATABASE" <"$SQL_FILE"
  exit 0
fi

echo "Instale o cliente mysql ou suba vilareal-db / túnel SSH (porta ${VILAREAL_MYSQL_PORT})." >&2
exit 1
