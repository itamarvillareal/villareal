#!/usr/bin/env bash
# Limpa toda a tabela agenda_evento e importa de novo a planilha "total" (layout A=data, B=hora, C=desc).
#
# Pré-requisitos: MySQL acessível, backend não precisa estar parado; Node na pasta do front; ficheiro .xlsx.
#
# Uso:
#   export VILAREAL_IMPORT_SENHA='sua_senha'
#   ./e-vilareal-java-backend/scripts/reimportar_agenda_itamar_total.sh
#   ./e-vilareal-java-backend/scripts/reimportar_agenda_itamar_total.sh "/outro/caminho/planilha.xlsx"
#
# Opcional: MYSQL_USER, MYSQL_DB, MYSQL_PWD (senha MySQL). Sem MYSQL_PWD usa -proot (só dev local).

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/../.." && pwd)
WEB_ROOT="$REPO_ROOT/e-vilareal-react-web"

MYSQL_USER="${MYSQL_USER:-root}"
MYSQL_DB="${MYSQL_DB:-vilareal}"
# Caminho fixo da planilha (máquina Itamar); pode sobrepor: ./script.sh "/outro.xlsx"
XLSX_FIXO="/Users/itamarvillarealjunior/Dropbox/COMUM/agenda itamar total.xlsx"
XLSX_PATH="${1:-$XLSX_FIXO}"
if [[ ! -f "$XLSX_PATH" && -f "${HOME}/Dropbox/COMUM/agenda itamar total.xlsx" ]]; then
  XLSX_PATH="${HOME}/Dropbox/COMUM/agenda itamar total.xlsx"
fi

if [[ -z "${VILAREAL_IMPORT_SENHA:-}" ]]; then
  echo "Erro: defina VILAREAL_IMPORT_SENHA (mesma senha do login itamar na API)." >&2
  exit 1
fi

if [[ ! -f "$XLSX_PATH" ]]; then
  echo "Erro: ficheiro não encontrado: $XLSX_PATH" >&2
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

echo "→ A apagar todos os eventos de agenda ($MYSQL_DB)…"
mysql_exec -e "START TRANSACTION; DELETE FROM agenda_evento; COMMIT;"
COUNT=$(mysql_exec -Nse "SELECT COUNT(*) FROM agenda_evento;")
echo "→ Linhas restantes em agenda_evento: $COUNT"

echo "→ A importar: $XLSX_PATH"
cd "$WEB_ROOT"
export VILAREAL_IMPORT_SENHA
node scripts/import-agenda-planilha.mjs "$XLSX_PATH" --layout=total --login=itamar

echo "→ Concluído. Recarregue a Agenda no browser (VITE_USE_API_AGENDA=true)."
