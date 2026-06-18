#!/usr/bin/env bash
# Dispara 752, 800 e 928 em paralelo (sem 728). Checkpoint/log por cliente.
set -eo pipefail
cd "$(dirname "$0")/.."

if [[ -f .env.import.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.import.local
  set +a
fi

for c in 752 800 928; do
  echo "A iniciar paralelo cliente ${c}..."
  node scripts/executar-reimport-historico-texto-paralelo.mjs --cliente="${c}" \
    >> "tmp/reimport-historico-paralelo-${c}.log" 2>&1 &
done

echo "Paralelo: clientes 752 800 928 - logs tmp/reimport-historico-paralelo-*.log"
wait
echo "Paralelo concluído."
