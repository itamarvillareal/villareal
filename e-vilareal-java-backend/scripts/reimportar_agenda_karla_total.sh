#!/usr/bin/env bash
# Apaga apenas os eventos de agenda da Karla e importa a planilha "total" (A=data, B=hora, C=desc).
#
# Pré-requisitos: MySQL, Node na pasta do front; ficheiro .xlsx (criar em COMUM como "agenda karla total.xlsx" se ainda não existir).
#
# Uso (login da própria Karla na API):
#   export VILAREAL_IMPORT_SENHA='senha_da_karla'
#   ./e-vilareal-java-backend/scripts/reimportar_agenda_karla_total.sh
#
# Uso (operador itamar importa para a conta da Karla — requer backend que aceite usuarioId no corpo):
#   export VILAREAL_IMPORT_SENHA='senha_itamar'
#   export VILAREAL_IMPORT_AS_KARLA=1
#   ./e-vilareal-java-backend/scripts/reimportar_agenda_karla_total.sh
#
# Opcional: caminho da planilha como 1.º argumento. KARLA_USUARIO_ID (padrão 2; migração V24) se o id diferir no ambiente.

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/../.." && pwd)
WEB_ROOT="$REPO_ROOT/e-vilareal-react-web"

MYSQL_USER="${MYSQL_USER:-root}"
MYSQL_DB="${MYSQL_DB:-vilareal}"
KARLA_USUARIO_ID="${KARLA_USUARIO_ID:-2}"

XLSX_FIXO="/Users/itamarvillarealjunior/Dropbox/COMUM/agenda karla total.xlsx"
XLSX_PATH="${1:-$XLSX_FIXO}"
if [[ ! -f "$XLSX_PATH" && -f "${HOME}/Dropbox/COMUM/agenda karla total.xlsx" ]]; then
  XLSX_PATH="${HOME}/Dropbox/COMUM/agenda karla total.xlsx"
fi

if [[ -z "${VILAREAL_IMPORT_SENHA:-}" ]]; then
  echo "Erro: defina VILAREAL_IMPORT_SENHA (senha do login usado na API — Karla ou operador)." >&2
  exit 1
fi

if [[ ! -f "$XLSX_PATH" ]]; then
  echo "Erro: ficheiro não encontrado: $XLSX_PATH" >&2
  echo "Coloque a planilha em Dropbox/COMUM como \"agenda karla total.xlsx\" ou passe o caminho como argumento." >&2
  exit 1
fi

if [[ ! -d "$WEB_ROOT" ]]; then
  echo "Erro: pasta do front não encontrada: $WEB_ROOT" >&2
  exit 1
fi

mysql_exec() {
  if [[ -n "${MYSQL_PWD:-}" ]]; then
    mysql -u "$MYSQL_USER" -p"$MYSQL_PWD" "$MYSQL_DB" "$@"
  else
    mysql -u "$MYSQL_USER" -proot "$MYSQL_DB" "$@"
  fi
}

echo "→ A apagar eventos de agenda do utilizador id=$KARLA_USUARIO_ID ($MYSQL_DB)…"
mysql_exec -e "START TRANSACTION; DELETE FROM agenda_evento WHERE usuario_id = ${KARLA_USUARIO_ID}; COMMIT;"
COUNT=$(mysql_exec -Nse "SELECT COUNT(*) FROM agenda_evento WHERE usuario_id = ${KARLA_USUARIO_ID};")
echo "→ Eventos restantes deste utilizador: $COUNT"

# Sempre grava em usuario_id=KARLA_USUARIO_ID (padrão 2).
KARLA_LOGIN_PADRAO='karla.pedroza@villarealadvocacia.adv.br'
if [[ -n "${VILAREAL_IMPORT_AS_KARLA:-}" ]]; then
  # JWT do operador; corpo com usuario_id da Karla (se a API permitir).
  IMPORT_LOGIN="${VILAREAL_IMPORT_LOGIN:-itamar}"
else
  IMPORT_LOGIN="${VILAREAL_IMPORT_LOGIN:-$KARLA_LOGIN_PADRAO}"
fi

echo "→ A importar: $XLSX_PATH (login API: $IMPORT_LOGIN, usuario_id: $KARLA_USUARIO_ID)"
cd "$WEB_ROOT"
export VILAREAL_IMPORT_SENHA
node scripts/import-agenda-planilha.mjs "$XLSX_PATH" --layout=total --login="$IMPORT_LOGIN" --usuario-id="${KARLA_USUARIO_ID}"

echo "→ Concluído. Recarregue a Agenda no browser (VITE_USE_API_AGENDA=true)."
