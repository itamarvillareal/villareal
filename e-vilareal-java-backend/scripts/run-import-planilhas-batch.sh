#!/usr/bin/env bash
# Importa as três planilhas na ordem: Pessoas (.xls) → clientes (.xlsx) → imóveis (.xlsx).
# Ajuste os paths abaixo ou exporte as variáveis antes de chamar este script.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export VILAREAL_IMPORT_BATCH_ENABLED=true
export VILAREAL_IMPORT_BATCH_PATH_PESSOAS="${VILAREAL_IMPORT_BATCH_PATH_PESSOAS:-/Users/itamarvillarealjunior/Downloads/Cadastro Pessoas - Itamar (1).xls}"
export VILAREAL_IMPORT_BATCH_PATH_CLIENTES="${VILAREAL_IMPORT_BATCH_PATH_CLIENTES:-/Users/itamarvillarealjunior/Dropbox/COMUM/import clientes.xlsx}"
export VILAREAL_IMPORT_BATCH_PATH_IMOVEIS="${VILAREAL_IMPORT_BATCH_PATH_IMOVEIS:-/Users/itamarvillarealjunior/Dropbox/COMUM/imoveis.xlsx}"
# true = só simula pessoas e gera CSV; false = grava pessoas no MySQL
export VILAREAL_IMPORT_BATCH_PESSOAS_DRY_RUN="${VILAREAL_IMPORT_BATCH_PESSOAS_DRY_RUN:-false}"

./mvnw spring-boot:run -Dspring-boot.run.profiles=import-planilhas-batch,dev
