#!/usr/bin/env bash
# Recadastra a senha PROJUDI no cofre com a chave AES atual (.projudi-cred-key.local).
# Use quando aparecer erro de PROJUDI_CRED_KEY / AEADBadTagException.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KEY_FILE="$ROOT/.projudi-cred-key.local"
API="${API_BASE:-http://localhost:8080}"

if [[ ! -f "$KEY_FILE" ]]; then
  echo "Arquivo de chave não encontrado: $KEY_FILE"
  echo "Suba o backend uma vez com ./scripts/run-dev.sh (cria o arquivo) ou gere:"
  echo "  openssl rand -base64 32 > $KEY_FILE && chmod 600 $KEY_FILE"
  exit 1
fi

CPF="${1:-00733235190}"
ROTULO="${2:-dev-local}"

echo "Cofre PROJUDI — recadastro (CPF ${CPF})"
echo "Chave AES: $KEY_FILE"
echo -n "Senha PROJUDI: "
read -rs SENHA
echo
if [[ -z "$SENHA" ]]; then
  echo "Senha vazia — abortado."
  exit 1
fi

HTTP=$(curl -s -o /tmp/projudi-cred-resp.json -w "%{http_code}" \
  -X POST "$API/api/projudi/admin/credencial" \
  -H 'Content-Type: application/json' \
  -d "$(python3 -c "import json,sys; print(json.dumps({'cpf':sys.argv[1],'senha':sys.argv[2],'rotulo':sys.argv[3]}))" "$CPF" "$SENHA" "$ROTULO")")

if [[ "$HTTP" != "200" ]]; then
  echo "Falha HTTP $HTTP:"
  cat /tmp/projudi-cred-resp.json
  exit 1
fi

echo "Credencial salva com sucesso."
echo "Pronto. Tente «Obter movimentações» no processo."
rm -f /tmp/projudi-cred-resp.json 2>/dev/null || true
