#!/usr/bin/env bash
# preencher-pessoa-vinculada-clientes.sh
# Preenche SOMENTE o número da Pessoa vinculada a cada cliente (cliente.pessoa_id),
# lendo o arquivo legado «Gerais/.../{cod8}.151.1.0.txt».
#
# Usa --substituir: corrige tambem os vinculos divergentes ja existentes
# (clientes auto-criados apontando para o titular, e nao para a pessoa real).
#
# Uso:
#   bash preencher-pessoa-vinculada-clientes.sh                 # clientes 1..999
#   bash preencher-pessoa-vinculada-clientes.sh 1 300           # intervalo custom
#   bash preencher-pessoa-vinculada-clientes.sh --dry-run       # so simula (sem gravar)
set -uo pipefail
cd /Users/itamar/Documents/villareal

MODO="--aplicar"
MIN=1
MAX=999
POS=()
for a in "$@"; do
  case "$a" in
    --dry-run) MODO="--dry-run" ;;
    --aplicar) MODO="--aplicar" ;;
    *) POS+=("$a") ;;
  esac
done
[ "${#POS[@]}" -ge 1 ] && MIN="${POS[0]}"
[ "${#POS[@]}" -ge 2 ] && MAX="${POS[1]}"

# Garante backend de pé (a fase de --substituir tambem fala com a API).
if ! curl -sf -m 2 http://127.0.0.1:8080/actuator/health >/dev/null 2>&1; then
  echo "ERRO: backend nao esta UP em http://127.0.0.1:8080 — suba o backend antes."
  exit 1
fi

# --substituir grava direto no MySQL; aponta para o vilareal-db do Docker (porta 3307).
export VILAREAL_MYSQL_HOST="${VILAREAL_MYSQL_HOST:-127.0.0.1}"
export VILAREAL_MYSQL_PORT="${VILAREAL_MYSQL_PORT:-3307}"

EXTRA=""
[ "$MODO" = "--aplicar" ] && EXTRA="--substituir"

echo "=== Preencher Pessoa vinculada (cliente.pessoa_id) — modo=$MODO clientes ${MIN}..${MAX} ==="
cd e-vilareal-react-web
node scripts/import-cliente-pessoa-151-txt.mjs "$MODO" $EXTRA \
  --cliente-min="$MIN" --cliente-max="$MAX"
