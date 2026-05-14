#!/bin/bash
# Sincroniza o banco da VPS para o MySQL local (Docker)
# Uso: ./scripts/sync-db-local.sh

VPS_HOST="root@161.97.175.73"
LOCAL_CONTAINER="vilareal-local-db"
DB_NAME="vilareal"
DUMP_FILE="/tmp/vilareal-sync.sql"

echo "Fazendo dump do banco na VPS..."
ssh $VPS_HOST "mysqldump -u root -proot $DB_NAME 2>/dev/null" > $DUMP_FILE

if [ ! -s "$DUMP_FILE" ]; then
  echo "Erro: dump vazio ou falhou."
  exit 1
fi

echo "Tamanho do dump: $(du -h $DUMP_FILE | cut -f1)"

echo "Limpando banco local..."
docker exec $LOCAL_CONTAINER mysql -u root -proot -e "DROP DATABASE IF EXISTS $DB_NAME; CREATE DATABASE $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null

echo "Importando no MySQL local..."
docker exec -i $LOCAL_CONTAINER mysql -u root -proot $DB_NAME < $DUMP_FILE 2>/dev/null

TABLES=$(docker exec $LOCAL_CONTAINER mysql -u root -proot -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME';" 2>/dev/null)
echo "Sincronizacao concluida! $TABLES tabelas importadas."

rm -f $DUMP_FILE
