#!/usr/bin/env bash
# Sincroniza catálogos compartilhados entre schemas MySQL na mesma instância.
# Não copia dados de negócio (clientes, processos, financeiro, usuários, etc.).
#
# Uso (na VPS ou com túnel):
#   ./scripts/sync-catalogo-instancia.sh \
#     --source vilareal --target vilareal_portal1 \
#     --user root --password '...'
#
# Ou via env:
#   VILLAREAL_COMPOSE_JDBC_USER / VILLAREAL_COMPOSE_JDBC_PASSWORD
#   CATALOG_SOURCE_DB / CATALOG_TARGET_DB
set -euo pipefail

SOURCE_DB="${CATALOG_SOURCE_DB:-vilareal}"
TARGET_DB="${CATALOG_TARGET_DB:-vilareal_portal1}"
MYSQL_USER="${VILLAREAL_COMPOSE_JDBC_USER:-root}"
MYSQL_PASSWORD="${VILLAREAL_COMPOSE_JDBC_PASSWORD:-}"
MYSQL_HOST="${CATALOG_MYSQL_HOST:-127.0.0.1}"
MYSQL_PORT="${CATALOG_MYSQL_PORT:-3306}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source) SOURCE_DB="$2"; shift 2 ;;
    --target) TARGET_DB="$2"; shift 2 ;;
    --user) MYSQL_USER="$2"; shift 2 ;;
    --password) MYSQL_PASSWORD="$2"; shift 2 ;;
    --host) MYSQL_HOST="$2"; shift 2 ;;
    --port) MYSQL_PORT="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,16p' "$0"
      exit 0
      ;;
    *) echo "Opção desconhecida: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "$MYSQL_PASSWORD" ]]; then
  echo "Defina --password ou VILLAREAL_COMPOSE_JDBC_PASSWORD." >&2
  exit 2
fi

MYSQL=(mysql -h"$MYSQL_HOST" -P"$MYSQL_PORT" -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" --batch --raw -N)
run_sql() {
  "${MYSQL[@]}" -e "$1" 2> >(grep -v "Using a password" >&2 || true)
}

echo "Catálogo: ${SOURCE_DB} -> ${TARGET_DB}"

exists_source=$(run_sql "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name='${SOURCE_DB}'" | tr -d '[:space:]')
exists_target=$(run_sql "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name='${TARGET_DB}'" | tr -d '[:space:]')
if [[ "$exists_source" != "1" || "$exists_target" != "1" ]]; then
  echo "Schemas inválidos (source=${exists_source}, target=${exists_target})." >&2
  exit 1
fi

# Upsert canônico; preserva favorito/uso_count no destino.
run_sql "
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;

INSERT INTO \`${TARGET_DB}\`.estado (id, sigla, nome)
SELECT id, sigla, nome FROM \`${SOURCE_DB}\`.estado
ON DUPLICATE KEY UPDATE sigla=VALUES(sigla), nome=VALUES(nome);

INSERT INTO \`${TARGET_DB}\`.municipio (id, nome, nome_normalizado, uf_id)
SELECT id, nome, nome_normalizado, uf_id FROM \`${SOURCE_DB}\`.municipio
ON DUPLICATE KEY UPDATE
  nome=VALUES(nome),
  nome_normalizado=VALUES(nome_normalizado),
  uf_id=VALUES(uf_id);

INSERT INTO \`${TARGET_DB}\`.tribunal (id, sigla, nome, uf_id, datajud_alias, ativo, ultima_sincronizacao)
SELECT id, sigla, nome, uf_id, datajud_alias, ativo, ultima_sincronizacao FROM \`${SOURCE_DB}\`.tribunal
ON DUPLICATE KEY UPDATE
  sigla=VALUES(sigla),
  nome=VALUES(nome),
  uf_id=VALUES(uf_id),
  datajud_alias=VALUES(datajud_alias),
  ativo=VALUES(ativo),
  ultima_sincronizacao=VALUES(ultima_sincronizacao);

INSERT INTO \`${TARGET_DB}\`.orgao_julgador (
  id, tribunal_id, codigo_cnj, nome, nome_normalizado, grau, tipo,
  municipio_id, ativo, fonte, synced_at, criado_em, atualizado_em
)
SELECT
  id, tribunal_id, codigo_cnj, nome, nome_normalizado, grau, tipo,
  municipio_id, ativo, fonte, synced_at, criado_em, atualizado_em
FROM \`${SOURCE_DB}\`.orgao_julgador
ON DUPLICATE KEY UPDATE
  tribunal_id=VALUES(tribunal_id),
  codigo_cnj=VALUES(codigo_cnj),
  nome=VALUES(nome),
  nome_normalizado=VALUES(nome_normalizado),
  grau=VALUES(grau),
  tipo=VALUES(tipo),
  municipio_id=VALUES(municipio_id),
  ativo=VALUES(ativo),
  fonte=VALUES(fonte),
  synced_at=VALUES(synced_at),
  atualizado_em=VALUES(atualizado_em);

INSERT INTO \`${TARGET_DB}\`.calculo_indice_mensal (indice, competencia, valor, created_at, updated_at)
SELECT indice, competencia, valor, created_at, updated_at FROM \`${SOURCE_DB}\`.calculo_indice_mensal
ON DUPLICATE KEY UPDATE
  valor=VALUES(valor),
  updated_at=VALUES(updated_at);

SET FOREIGN_KEY_CHECKS=1;
"

run_sql "
SELECT 'estado' t, COUNT(*) c FROM \`${TARGET_DB}\`.estado
UNION ALL SELECT 'municipio', COUNT(*) FROM \`${TARGET_DB}\`.municipio
UNION ALL SELECT 'tribunal', COUNT(*) FROM \`${TARGET_DB}\`.tribunal
UNION ALL SELECT 'orgao_julgador', COUNT(*) FROM \`${TARGET_DB}\`.orgao_julgador
UNION ALL SELECT 'calculo_indice_mensal', COUNT(*) FROM \`${TARGET_DB}\`.calculo_indice_mensal;
"

echo "Sync de catálogo concluído."
