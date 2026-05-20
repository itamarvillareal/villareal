#!/usr/bin/env bash
# Importa imóveis a partir do export padrão Itamar (layout administracao).
set -euo pipefail
cd "$(dirname "$0")/.."
PLANILHA="${VILAREAL_IMPORT_IMOVEIS_PLANILHA_PATH:-$HOME/Dropbox/sistema/Villa Real - Administração de Imóveis - Itamar.xls}"
exec node scripts/import-imoveis-planilha.mjs "$PLANILHA" --layout=itamar --login="${VILAREAL_IMPORT_LOGIN:-itamar}" "$@"
