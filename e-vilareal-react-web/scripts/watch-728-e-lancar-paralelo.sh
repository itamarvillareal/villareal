#!/usr/bin/env bash
# Espera cliente 728 OK no log principal, mata o job sequencial e lanca 752+800+928 em paralelo.
set -eo pipefail
cd "$(dirname "$0")/.."

LOG="tmp/reimport-historico-exec.log"
echo "A aguardar conclusao do cliente 728 em ${LOG}..."

while true; do
  if grep -q 'cliente 728 — OK' "$LOG" 2>/dev/null || grep -q 'cliente 728 - OK' "$LOG" 2>/dev/null; then
    echo "728 OK detectado."
    break
  fi
  if ! pgrep -f 'import-historico-local-txt.mjs --cliente=728.*substituir-andamentos' >/dev/null 2>&1; then
    if grep -q 'cliente 728 — FALHA' "$LOG" 2>/dev/null || grep -q 'cliente 728 - FALHA' "$LOG" 2>/dev/null; then
      echo "728 falhou - nao lanco paralelo."
      exit 1
    fi
  fi
  sleep 15
done

echo "A matar job sequencial (executar-reimport)..."
pkill -f 'executar-reimport-historico-texto.mjs --continuar' 2>/dev/null || true
sleep 2

echo "A matar import 728 --apenas-novos (conflito)..."
pkill -f 'import-historico-local-txt.mjs --clientes=728.*apenas-novos' 2>/dev/null || true

echo "A fundir 728 no checkpoint principal se ainda nao estiver..."
node -e "
const fs=require('fs');
const p='tmp/reimport-historico-checkpoint.json';
const cp=JSON.parse(fs.readFileSync(p,'utf8'));
const s=new Set(cp.concluidos||[]);
if(s.add(728)) { cp.concluidos=[...s].sort((a,b)=>a-b); fs.writeFileSync(p,JSON.stringify(cp,null,2)+'\n'); console.log('728 adicionado ao checkpoint'); }
else console.log('728 ja no checkpoint');
"

bash scripts/run-reimport-paralelo-restantes.sh
