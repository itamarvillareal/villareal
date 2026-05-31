#!/usr/bin/env bash
# run-import-completo.sh
# Orquestra a importacao completa, NA ORDEM:
#   1) Cadastro de Pessoas      (Java/Spring Boot - run-import-pessoas.sh)
#   2) import-real de Processos (por cliente, 1..999)
#   3) import de Calculos       (import-calculos-txt, por cliente, 1..999)
#   4) Demais scripts de importacao de arquivos TXT
#   5) Planilha «Extratos Bancos - Itamar.xls» (todos os bancos)
#
# SEGURO POR PADRAO: roda em --dry-run (nao grava nada). Use --aplicar para valer.
#
# Uso:
#   bash scripts/run-import-completo.sh                          # dry-run, clientes 1..999
#   bash scripts/run-import-completo.sh --aplicar                # aplica de verdade
#   bash scripts/run-import-completo.sh --aplicar --cliente-min=1 --cliente-max=300
#   bash scripts/run-import-completo.sh --aplicar --pular-pessoas
#
# Nao aborta no primeiro erro: cada fase eh registrada (OK/FALHA) e a execucao continua.
# A fase de Pessoas roda com --force: importa as ~7186 linhas validas e ignora os
# ~2589 bloqueios automaticamente, sem abortar.
# Logs por fase ficam em: tmp/import-completo-<timestamp>/

set -uo pipefail
cd "$(dirname "$0")/.."                      # raiz do e-vilareal-react-web
ROOT="$(pwd)"
BACKEND_DIR="$(cd "$ROOT/.." && pwd)/e-vilareal-java-backend"

# ===========================================================================
# CONFIGURACAO — INTERVALO DE CLIENTES (edite aqui se quiser fixar no script)
# Estes valores valem para as fases que rodam por cliente:
#   import-real, calculos e processo-partes (e o intervalo de historico/151).
# Podem ser sobrescritos pela linha de comando: --cliente-min=N --cliente-max=N
# ===========================================================================
CLIENTE_MIN=1
CLIENTE_MAX=999

# ---------------------------------------------------------------------------
# Argumentos
# ---------------------------------------------------------------------------
APLICAR=false
PULAR_PESSOAS=false

for a in "$@"; do
  case "$a" in
    --aplicar)        APLICAR=true ;;
    --dry-run)        APLICAR=false ;;
    --cliente-min=*)  CLIENTE_MIN="${a#*=}" ;;
    --cliente-max=*)  CLIENTE_MAX="${a#*=}" ;;
    --pular-pessoas)  PULAR_PESSOAS=true ;;
    -h|--help)
      grep -E '^#( |$)' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) echo "Opcao desconhecida: $a" >&2; exit 1 ;;
  esac
done

if $APLICAR; then MODO="--aplicar"; else MODO="--dry-run"; fi

TS="$(date +%Y%m%d-%H%M%S)"
LOGDIR="$ROOT/tmp/import-completo-$TS"
mkdir -p "$LOGDIR"
RESUMO="$LOGDIR/resumo.log"

log() { echo "$@" | tee -a "$RESUMO"; }

# Executa um comando como "fase" unica: log dedicado + status OK/FALHA, sem abortar.
run_fase() {
  local nome="$1"; shift
  local logf="$LOGDIR/${nome}.log"
  log ""
  log "========== FASE: $nome ($(date '+%H:%M:%S')) =========="
  log "CMD: $*"
  if "$@" >"$logf" 2>&1; then
    log "OK: $nome   (log: $logf)"
  else
    local code=$?
    log "FALHA: $nome (code=$code)   (log: $logf)"
  fi
}

# Executa um script node por cliente (1..N), agregando tudo num unico log.
run_loop_clientes() {
  local nome="$1"; shift   # rotulo da fase
  local script="$1"; shift # caminho do .mjs
  local logf="$LOGDIR/${nome}.log"
  local ok=0 fail=0 n=0
  : >"$logf"
  log ""
  log "========== FASE (loop ${CLIENTE_MIN}-${CLIENTE_MAX}): $nome ($(date '+%H:%M:%S')) =========="
  local c
  for ((c=CLIENTE_MIN; c<=CLIENTE_MAX; c++)); do
    n=$((n + 1))
    {
      echo ""
      echo "########## [$nome] cliente $c ##########"
    } >>"$logf"
    if node "$script" --cliente="$c" "$MODO" "$@" >>"$logf" 2>&1; then
      ok=$((ok + 1))
    else
      fail=$((fail + 1))
      echo "[$nome] cliente $c FALHA" >>"$logf"
    fi
  done
  log "Concluido $nome: ok=$ok falha=$fail total=$n   (log: $logf)"
}

log "Inicio $(date) — modo=$MODO — clientes ${CLIENTE_MIN}..${CLIENTE_MAX}"
log "Raiz: $ROOT"
log "Backend (pessoas): $BACKEND_DIR"
log "Logs: $LOGDIR"

# ---------------------------------------------------------------------------
# 1) CADASTRO DE PESSOAS
# ---------------------------------------------------------------------------
if ! $PULAR_PESSOAS; then
  # --force: importa as ~7186 linhas validas e ignora os ~2589 bloqueios, sem abortar.
  run_fase "1-pessoas" bash "$BACKEND_DIR/scripts/run-import-pessoas.sh" "$MODO" --force
else
  log ""
  log "Fase 1 (pessoas) pulada (--pular-pessoas)."
fi

# ---------------------------------------------------------------------------
# 2) IMPORT-REAL DE PROCESSOS (por cliente)
# ---------------------------------------------------------------------------
run_loop_clientes "2-import-real" "scripts/import-real.mjs"

# ---------------------------------------------------------------------------
# 3) IMPORT DE CALCULOS (por cliente)
# ---------------------------------------------------------------------------
run_loop_clientes "3-calculos" "scripts/import-calculos-txt.mjs"

# ---------------------------------------------------------------------------
# 4) DEMAIS SCRIPTS DE IMPORTACAO DE ARQUIVOS TXT
# ---------------------------------------------------------------------------
log ""
log "========== FASE 4: demais importacoes de arquivos TXT =========="

# 4a) Por cliente (exige --cliente=N)
run_loop_clientes "4a-processo-partes" "scripts/import-processo-partes-txt.mjs"

# 4b) Globais / por intervalo (rodam de uma vez para 1..999)
run_fase "4b-historico-local"    node scripts/import-historico-local-txt.mjs   "$MODO" --cliente-min="$CLIENTE_MIN" --cliente-max="$CLIENTE_MAX"
run_fase "4c-cliente-pessoa-151" node scripts/import-cliente-pessoa-151-txt.mjs "$MODO" --cliente-min="$CLIENTE_MIN" --cliente-max="$CLIENTE_MAX"
run_fase "4d-fases-processos"    node scripts/import-fases-processos-txt.mjs    "$MODO"
run_fase "4e-proc-imovel-vinculo" node scripts/import-proc-imovel-vinculo-txt.mjs "$MODO"
run_fase "4f-processo-semantic"  node scripts/import-processo-semantic-txt.mjs  "$MODO"
run_fase "4g-agenda-local"       node scripts/import-agenda-local-txt.mjs       "$MODO"
run_fase "4h-topicos-hierarchy"  node scripts/import-topicos-hierarchy.mjs      "$MODO"
run_fase "4i-prazos-fatais"      node scripts/sync-prazos-fatais-dropbox.mjs    "$MODO"

# ---------------------------------------------------------------------------
# 5) PLANILHA «Extratos Bancos - Itamar.xls» (todos os bancos)
# ---------------------------------------------------------------------------
log ""
log "========== FASE 5: extratos bancarios (planilha) =========="
run_fase "5-extrato-bancos" node scripts/import-extrato-bancos-planilha.mjs \
  "$MODO" --todos-bancos --substituir --login=itamar

# ---------------------------------------------------------------------------
log ""
log "========== FIM $(date) =========="
log "Resumo: $RESUMO"
echo ""
echo "Importacao completa finalizada (modo=$MODO). Veja o resumo em:"
echo "  $RESUMO"
