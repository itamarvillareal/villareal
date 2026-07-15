#!/usr/bin/env bash
# Atalho na raiz do repositório — funciona de qualquer pasta se você passar o caminho completo.
set -euo pipefail
exec bash "$(cd "$(dirname "$0")/.." && pwd)/e-vilareal-local-helper/install.sh"
