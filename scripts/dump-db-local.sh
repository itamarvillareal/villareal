#!/bin/bash
# Dump do MySQL local oficial (vilareal-db).
# Uso: ./scripts/dump-db-local.sh [ficheiro.sql]
set -euo pipefail
cd "$(dirname "$0")/.."

OUT="${1:-./vilareal-local-$(date +%Y%m%d_%H%M).sql}"
CONTAINER="vilareal-db"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "Container $CONTAINER não está a correr."
  echo "Suba: docker compose -f docker-compose.yml -f docker-compose.local-db.yml up -d db"
  exit 1
fi

docker exec "$CONTAINER" mysqldump -u root -proot vilareal >"$OUT"
echo "Dump gravado: $OUT ($(du -h "$OUT" | cut -f1))"
