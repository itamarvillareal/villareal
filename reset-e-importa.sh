#!/usr/bin/env bash
set -uo pipefail
cd /Users/itamar/Documents/villareal

# 0) mata backend na 8080
pids=$(lsof -ti tcp:8080 2>/dev/null); [ -n "$pids" ] && kill -9 $pids 2>/dev/null || true

# 1) recria a base vazia
docker exec vilareal-db mysql -uroot -proot -e \
  "DROP DATABASE IF EXISTS vilareal; CREATE DATABASE vilareal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 2) sobe o backend (Flyway aplica as migrations, inclusive a V79)
( cd e-vilareal-java-backend && bash scripts/run-dev.sh > /tmp/vilareal-backend.log 2>&1 & )
echo "Aguardando backend..."
ok=0
for i in $(seq 1 150); do
  if curl -sf -m 2 http://127.0.0.1:8080/actuator/health >/dev/null 2>&1; then ok=1; echo "Backend pronto."; break; fi
  sleep 2
done
if [ "$ok" -ne 1 ]; then
  echo ""
  echo "ERRO: backend NAO subiu — abortando o import (senao fases 2/3 dao 0/300 sem motivo)."
  echo "----- ultimas 40 linhas de /tmp/vilareal-backend.log -----"
  tail -40 /tmp/vilareal-backend.log
  exit 1
fi

# 3) import completo
cd e-vilareal-react-web
bash scripts/run-import-completo.sh --aplicar --cliente-min=1 --cliente-max=300
