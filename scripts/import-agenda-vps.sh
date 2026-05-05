#!/usr/bin/env bash
# Importa compromissos da planilha para o MySQL na VPS através da API do portal
# (POST /api/agenda/eventos). Texto: normalizarTextoPlanilha no Node + Utf8MojibakeUtil ao persistir no backend.
#
# Uso:
#   export VILAREAL_IMPORT_SENHA='senha do usuarios.login'
#   ./scripts/import-agenda-vps.sh "/caminho/planilha.xlsx" --layout=total --login=itamar
#
# Opcional: VILAREAL_API_BASE (padrão = portal em produção)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WEB_ROOT="$REPO_ROOT/e-vilareal-react-web"

export VILAREAL_API_BASE="${VILAREAL_API_BASE:-https://portal.villarealadvocacia.adv.br}"

if [[ -z "${VILAREAL_IMPORT_SENHA:-}" ]]; then
  echo "Erro: defina VILAREAL_IMPORT_SENHA (mesma senha do login na API / usuarios.login)." >&2
  exit 1
fi

if [[ $# -lt 1 ]]; then
  cat >&2 <<'EOF'
Uso:
  VILAREAL_IMPORT_SENHA='***' ./scripts/import-agenda-vps.sh "<ficheiro.xls|.xlsx>" [opções do import-agenda-planilha.mjs]

Exemplos:
  ./scripts/import-agenda-vps.sh "$HOME/Dropbox/COMUM/agenda itamar total.xlsx" --layout=total --login=itamar
  ./scripts/import-agenda-vps.sh "$HOME/Dropbox/COMUM/agenda karla total.xlsx" --layout=total --login=karla.pedroza --usuario-id=2
  ./scripts/import-agenda-vps.sh AGENDAS.XLS --layout=agendas-multi --login=itamar

Variáveis:
  VILAREAL_API_BASE   API sem sufixo /api (default: https://portal.villarealadvocacia.adv.br)
  VILAREAL_IMPORT_SENHA   obrigatória
EOF
  exit 1
fi

if [[ ! -d "$WEB_ROOT" ]]; then
  echo "Erro: pasta do front não encontrada: $WEB_ROOT" >&2
  exit 1
fi

echo "→ API: $VILAREAL_API_BASE"
cd "$WEB_ROOT"
exec node scripts/import-agenda-planilha.mjs "$@"
