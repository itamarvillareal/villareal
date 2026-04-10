#!/usr/bin/env bash
# Apaga apenas os eventos de agenda da Ana Luísa e importa a planilha "total" (A=data, B=hora, C=desc).
#
# Pré-requisitos: MySQL, Node na pasta do front; ficheiro .xlsx em Dropbox/COMUM como "agenda ana luisa total.xlsx".
#
# Uso (login da própria Ana na API):
#   export VILAREAL_IMPORT_SENHA='senha_da_ana'
#   ./e-vilareal-java-backend/scripts/reimportar_agenda_ana_luisa_total.sh
#
# Uso (operador itamar importa para a conta da Ana — JWT do operador, usuarioId=3 no corpo):
#   export VILAREAL_IMPORT_SENHA='senha_itamar'
#   export VILAREAL_IMPORT_AS_ANA_LUISA=1
#   ./e-vilareal-java-backend/scripts/reimportar_agenda_ana_luisa_total.sh
#
# Opcional: caminho da planilha como 1.º argumento. ANA_USUARIO_ID (padrão 3; migração V24/V25) se o id diferir.

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/../.." && pwd)
WEB_ROOT="$REPO_ROOT/e-vilareal-react-web"

MYSQL_USER="${MYSQL_USER:-root}"
MYSQL_DB="${MYSQL_DB:-vilareal}"
ANA_USUARIO_ID="${ANA_USUARIO_ID:-3}"

XLSX_FIXO="/Users/itamarvillarealjunior/Dropbox/COMUM/agenda ana luisa total.xlsx"
XLSX_PATH="${1:-$XLSX_FIXO}"
if [[ ! -f "$XLSX_PATH" && -f "${HOME}/Dropbox/COMUM/agenda ana luisa total.xlsx" ]]; then
  XLSX_PATH="${HOME}/Dropbox/COMUM/agenda ana luisa total.xlsx"
fi

if [[ -z "${VILAREAL_IMPORT_SENHA:-}" ]]; then
  echo "Erro: defina VILAREAL_IMPORT_SENHA (senha do login usado na API — Ana ou operador)." >&2
  exit 1
fi

if [[ ! -f "$XLSX_PATH" ]]; then
  echo "Erro: ficheiro não encontrado: $XLSX_PATH" >&2
  echo "Coloque a planilha em Dropbox/COMUM como \"agenda ana luisa total.xlsx\" ou passe o caminho como argumento." >&2
  exit 1
fi

if [[ ! -d "$WEB_ROOT" ]]; then
  echo "Erro: pasta do front não encontrada: $WEB_ROOT" >&2
  exit 1
fi

# Login API: deve coincidir com usuarios.login (típico: ana.luisa; outro comum: analuisanunesdabadia@gmail.com).
ANA_LOGIN_PADRAO='ana.luisa'
if [[ -n "${VILAREAL_IMPORT_AS_ANA_LUISA:-}" ]]; then
  IMPORT_LOGIN="${VILAREAL_IMPORT_LOGIN:-itamar}"
else
  IMPORT_LOGIN="${VILAREAL_IMPORT_LOGIN:-$ANA_LOGIN_PADRAO}"
fi

mysql_exec() {
  if [[ -n "${MYSQL_PWD:-}" ]]; then
    mysql -u "$MYSQL_USER" -p"$MYSQL_PWD" "$MYSQL_DB" "$@"
  else
    mysql -u "$MYSQL_USER" -proot "$MYSQL_DB" "$@"
  fi
}

echo "→ A testar login na API ($IMPORT_LOGIN) antes de apagar eventos…"
cd "$WEB_ROOT"
export VILAREAL_IMPORT_SENHA
export IMPORT_LOGIN
if ! node --input-type=module -e "
const base = (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/\$/, '');
const login = String(process.env.IMPORT_LOGIN || '').trim().toLowerCase();
const senha = process.env.VILAREAL_IMPORT_SENHA || '';
const r = await fetch(base + '/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ login, senha }),
});
if (!r.ok) {
  const t = await r.text();
  console.error('Login falhou:', r.status, t);
  process.exit(1);
}
process.exit(0);
" 2>&1; then
  echo "Erro: corrija VILAREAL_IMPORT_SENHA e/ou VILAREAL_IMPORT_LOGIN (deve ser o valor de usuarios.login)." >&2
  echo "Consulta: mysql -e \"SELECT id, login FROM usuarios WHERE id = ${ANA_USUARIO_ID} OR login LIKE '%ana%' OR login LIKE '%luisa%' OR login LIKE '%luísa%';\"" >&2
  exit 1
fi

echo "→ A apagar eventos de agenda do utilizador id=$ANA_USUARIO_ID ($MYSQL_DB)…"
mysql_exec -e "START TRANSACTION; DELETE FROM agenda_evento WHERE usuario_id = ${ANA_USUARIO_ID}; COMMIT;"
COUNT=$(mysql_exec -Nse "SELECT COUNT(*) FROM agenda_evento WHERE usuario_id = ${ANA_USUARIO_ID};")
echo "→ Eventos restantes deste utilizador: $COUNT"

echo "→ A importar: $XLSX_PATH (login API: $IMPORT_LOGIN, usuario_id: $ANA_USUARIO_ID)"
node scripts/import-agenda-planilha.mjs "$XLSX_PATH" --layout=total --login="$IMPORT_LOGIN" --usuario-id="${ANA_USUARIO_ID}"

echo "→ Concluído. Recarregue a Agenda no browser (VITE_USE_API_AGENDA=true)."
