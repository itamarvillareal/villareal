#!/usr/bin/env bash
# Diagnóstico local (somente leitura) via túnel SSH para MySQL.
# Comandos SQL usados: SELECT, SHOW TABLES, DESCRIBE.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.local}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3308}"
DB_NAME="${DB_NAME:-vilareal}"
DB_USER="${DB_USER:-vilareal}"
DB_PASSWORD="${DB_PASSWORD:-}"

if [[ -z "$DB_PASSWORD" ]]; then
  echo "ERRO: DB_PASSWORD não definido. Configure no .env.local (ou exporte no terminal)." >&2
  exit 1
fi

MYSQL_CMD=(
  mysql
  --protocol=TCP
  -h "$DB_HOST"
  -P "$DB_PORT"
  -u "$DB_USER"
  "$DB_NAME"
  --batch
  --raw
)

run_sql() {
  local sql="$1"
  MYSQL_PWD="$DB_PASSWORD" "${MYSQL_CMD[@]}" -e "$sql"
}

echo "=== 1) Teste de conexão ==="
run_sql "SELECT DATABASE() AS database_name;"

echo
echo "=== 2) SHOW TABLES ==="
run_sql "SHOW TABLES;"

echo
echo "=== 3) Tabelas candidatas relacionadas a processos ==="
mapfile -t CANDIDATAS < <(
  run_sql "
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = '${DB_NAME}'
      AND (
        LOWER(table_name) LIKE '%processo%'
        OR LOWER(table_name) LIKE '%prazo%'
        OR LOWER(table_name) LIKE '%andamento%'
        OR LOWER(table_name) LIKE '%parte%'
      )
    ORDER BY table_name;
  " | tail -n +2
)

if [[ "${#CANDIDATAS[@]}" -eq 0 ]]; then
  echo "Nenhuma tabela candidata encontrada por nome."
  exit 0
fi

printf '%s\n' "${CANDIDATAS[@]}"

echo
echo "=== 4) COUNT(*) + DESCRIBE + LIMIT 5 por tabela candidata ==="
for tabela in "${CANDIDATAS[@]}"; do
  echo
  echo "--- Tabela: ${tabela} ---"
  run_sql "SELECT COUNT(*) AS total FROM \`${tabela}\`;"
  run_sql "DESCRIBE \`${tabela}\`;"
  run_sql "SELECT * FROM \`${tabela}\` LIMIT 5;"
done

echo
echo "Diagnóstico concluído (somente leitura)."
