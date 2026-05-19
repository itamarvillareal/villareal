#!/bin/bash
# Sincroniza o banco da VPS para o MySQL local Docker (container vilareal-db).
# Uso: ./scripts/sync-db-local.sh
#
# Pré-requisito:
#   docker compose -f docker-compose.yml -f docker-compose.local-db.yml up -d db

set -euo pipefail
cd "$(dirname "$0")/.."

VPS_HOST="${VPS_HOST:-root@161.97.175.73}"
LOCAL_CONTAINER="vilareal-db"
DB_NAME="vilareal"
DUMP_FILE="/tmp/vilareal-sync.sql"

if ! docker ps --format '{{.Names}}' | grep -qx "$LOCAL_CONTAINER"; then
  echo "Container $LOCAL_CONTAINER não está a correr."
  echo "Suba: docker compose -f docker-compose.yml -f docker-compose.local-db.yml up -d db"
  exit 1
fi

echo "Fazendo dump do banco na VPS..."
ssh "$VPS_HOST" "mysqldump -u root -proot $DB_NAME 2>/dev/null" >"$DUMP_FILE"

if [ ! -s "$DUMP_FILE" ]; then
  echo "Erro: dump vazio ou falhou."
  exit 1
fi

echo "Tamanho do dump: $(du -h "$DUMP_FILE" | cut -f1)"

echo "Limpando banco local..."
docker exec "$LOCAL_CONTAINER" mysql -u root -proot -e \
  "DROP DATABASE IF EXISTS $DB_NAME; CREATE DATABASE $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

echo "Importando no MySQL local..."
docker exec -i "$LOCAL_CONTAINER" mysql -u root -proot "$DB_NAME" <"$DUMP_FILE"

TABLES=$(docker exec "$LOCAL_CONTAINER" mysql -u root -proot -N -e \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME';")
echo "Sincronização concluída! $TABLES tabelas importadas."

rm -f "$DUMP_FILE"
