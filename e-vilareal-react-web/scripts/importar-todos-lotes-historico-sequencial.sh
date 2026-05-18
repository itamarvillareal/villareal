#!/usr/bin/env bash
# Importa histórico local (txt) em 10 lotes. Requer VILAREAL_IMPORT_SENHA (ou .env.import.local).
set -euo pipefail
cd "$(dirname "$0")/.."
LOGIN="${VILAREAL_IMPORT_LOGIN:-itamar}"
for n in $(seq 1 10); do
  echo ""
  echo "========== Lote $n / 10 =========="
  node scripts/import-historico-local-lotes.mjs --importar --login="$LOGIN" --lote="$n" || exit $?
done
echo ""
echo "Concluído. Resumo: /tmp/import-historico-local-lotes/resumo-importacao.json"
