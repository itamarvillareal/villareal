#!/usr/bin/env node
/**
 * Importa histórico a partir dos ficheiros txt locais (Dropbox «Banco de Dados») para a API
 * (`processo_andamento` na base MySQL), sem planilha intermédia obrigatória.
 *
 * Modelo de dados (legado):
 *   - Chave: **código do cliente** (8 dígitos) + **nº interno do processo**
 *   - Cada entrada (índice 1..N): **data** (tipo 16) + **informação** (tipo 15) + **utilizador** (tipo 17)
 *
 * Leitura: `lib/historico-local-txt-iterar.mjs` + `lib/historico-local-txt-paths.mjs`
 * (índice 14 → N; data em `Ano/aaaa/mm` ou `1000/centena/cliente`; cliente 728 em `1000/700/`).
 *
 * **Fase 1 — Correção** (por defeito, antes de ler/importar): ajusta índice **14** e renumera txt
 * quando o N declarado não bate com entradas válidas; elimina índice **14** sem histórico.
 * Ver `corrigir-historico-local-txt.mjs` / `lib/historico-local-txt-correcao.mjs`.
 *
 * **Fase 2 — Inserção**: mesma API que `import-historico-planilha.mjs`.
 *
 * Uso:
 *   VILAREAL_IMPORT_SENHA='***' node scripts/import-historico-local-txt.mjs --login=itamar
 *   node scripts/import-historico-local-txt.mjs --dry-run --cliente-min=1 --cliente-max=50
 *   node scripts/import-historico-local-txt.mjs --cliente=600 --nao-limpar-import --apenas-novos
 *   node scripts/import-historico-local-txt.mjs --gerar-xls=/tmp/historico-local.xls --dry-run
 *   node scripts/import-historico-local-txt.mjs --somente-corrigir --dry-run --cliente=728 --processo=143
 *
 * Fase de correção:
 *   --sem-corrigir           Não altera ficheiros txt antes da importação
 *   --somente-corrigir       Só análise/correção e termina (sem importar)
 *   --aplicar-correcao       Aplica correção nos txt (sem isto: só relatório em tela)
 *
 * Opções de leitura local:
 *   --base=PATH              Raiz «Banco de Dados» (defeito: Dropbox do utilizador)
 *   --cliente-min= --cliente-max=   Intervalo de códigos cliente (1..999)
 *   --cliente=N              Só um cliente
 *   --processo=N             Só um nº interno
 *   --contagens=JSON         Máx. processos por cliente (como no extrator)
 *   --limite-entradas=N      Cap de entradas lidas (0 = sem limite)
 *
 * Opções de importação (repasse para a API — ver `import-historico-planilha.mjs`):
 *   --login= --senha= --dry-run --origem=IMPORT_TXT_LOCAL
 *   --nao-limpar-import --sem-criar-processos --apenas-novos --apenas-orfaos
 *   --substituir-andamentos (com --cliente=)
 *   --apenas-codigos-entre=500,599
 *
 * Envs: VILAREAL_API_BASE, VILAREAL_IMPORT_SENHA, VILAREAL_IMPORT_CONCURRENCY, VILAREAL_IMPORT_ORIGEM
 */

import './lib/load-vilareal-import-env.mjs';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import XLSX from 'xlsx';

import { DEFAULT_BASE_HISTORICO_LOCAL } from './lib/historico-local-txt-paths.mjs';
import {
  executarAnaliseHistoricoLocal,
  executarCorrecaoHistoricoLocal,
} from './lib/historico-local-txt-correcao.mjs';
import { imprimirRelatorioAnaliseCorrecao } from './lib/historico-local-txt-relatorio.mjs';
import { coletarEntradasHistoricoLocal } from './lib/historico-local-txt-iterar.mjs';
import { movimentoEmFromHistoricoLocal } from './lib/historico-movimento-em.mjs';
import { normalizarResponsavelHistorico, resetAvisosResponsavel } from './lib/historico-responsavel-import.mjs';
import { normalizarTextoPlanilha } from './lib/normalizar-texto-planilha.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMPORT_PLANILHA_SCRIPT = path.join(__dirname, 'import-historico-planilha.mjs');
const ORIGEM_PADRAO_TXT = 'IMPORT_TXT_LOCAL';

function parseArgs(argv) {
  const out = {
    base: DEFAULT_BASE_HISTORICO_LOCAL,
    clienteMin: 1,
    clienteMax: 999,
    clienteFiltro: null,
    processoFiltro: null,
    contagensPath: null,
    limiteEntradas: 0,
    gerarXls: null,
    importArgv: [],
    dryRun: false,
    corrigirAntes: true,
    somenteCorrigir: false,
    aplicarCorrecao: false,
  };

  for (const a of argv) {
    if (a === '--sem-corrigir') out.corrigirAntes = false;
    else if (a === '--somente-corrigir') out.somenteCorrigir = true;
    else if (a === '--aplicar-correcao') out.aplicarCorrecao = true;
    else if (a.startsWith('--base=')) out.base = path.resolve(a.slice(7));
    else if (a.startsWith('--cliente-min=')) out.clienteMin = Math.max(1, Number(a.slice(14)) || 1);
    else if (a.startsWith('--cliente-max='))
      out.clienteMax = Math.min(999, Number(a.slice('--cliente-max='.length)) || 999);
    else if (a.startsWith('--cliente=')) {
      const n = Number(a.slice(10));
      if (Number.isFinite(n) && n >= 1) out.clienteFiltro = Math.trunc(n);
    } else if (a.startsWith('--processo=')) {
      const n = Number(a.slice(11));
      if (Number.isFinite(n) && n >= 1) out.processoFiltro = Math.trunc(n);
    } else if (a.startsWith('--contagens=')) out.contagensPath = path.resolve(a.slice(12));
    else if (a.startsWith('--limite-entradas=')) out.limiteEntradas = Math.max(0, Number(a.slice(18)) || 0);
    else if (a.startsWith('--gerar-xls=')) out.gerarXls = path.resolve(a.slice(12));
    else if (a === '--dry-run') {
      out.dryRun = true;
      out.importArgv.push(a);
    } else out.importArgv.push(a);
  }

  if (out.clienteFiltro != null) {
    out.clienteMin = out.clienteFiltro;
    out.clienteMax = out.clienteFiltro;
  }
  if (out.clienteMin > out.clienteMax) {
    const t = out.clienteMin;
    out.clienteMin = out.clienteMax;
    out.clienteMax = t;
  }

  const temOrigem = out.importArgv.some((x) => x.startsWith('--origem='));
  if (!temOrigem) {
    const envOrigem = (process.env.VILAREAL_IMPORT_ORIGEM || '').trim();
    out.importArgv.push(`--origem=${envOrigem || ORIGEM_PADRAO_TXT}`);
  }

  return out;
}

/**
 * @param {import('./lib/historico-local-txt-iterar.mjs').EntradaHistoricoLocal[]} entradas
 */
function entradasParaLinhasPlanilha(entradas) {
  /** @type {(string|number|null)[][]} */
  const rows = [];
  let linhaRef = 0;
  for (const e of entradas) {
    linhaRef += 1;
    let titulo = normalizarTextoPlanilha(e.informacao);
    if (!titulo.trim()) titulo = 'Andamento';
    if (titulo.length > 500) titulo = titulo.slice(0, 500);

    const movimentoEm = movimentoEmFromHistoricoLocal(e.dataBruta, e.yyyyPasta, e.mmPasta);
    let dataPlanilha = e.dataBruta || '';
    if (movimentoEm) {
      const [y, mo, da] = movimentoEm.slice(0, 10).split('-');
      dataPlanilha = `${da}/${mo}/${y}`;
    }

    const responsavel = normalizarResponsavelHistorico(
      e.usuarioBruto,
      `${e.codigoCliente8}/proc${e.numeroInterno}/idx${e.indice}`
    );

    rows.push([e.codigoCliente8, e.numeroInterno, '', titulo, dataPlanilha, responsavel ?? '']);
  }
  return { rows, linhaRef };
}

function gravarPlanilhaHistorico(outPath, rows) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Planilha2');
  const p = outPath.endsWith('.xls') ? outPath : outPath.replace(/\.xlsx?$/i, '') + '.xls';
  try {
    XLSX.writeFile(wb, p, { bookType: 'biff8' });
    return p;
  } catch {
    const alt = p.replace(/\.xls$/i, '.xlsx');
    XLSX.writeFile(wb, alt, { bookType: 'xlsx' });
    return alt;
  }
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  resetAvisosResponsavel();

  if (opts.corrigirAntes) {
    console.log('\n[txt] Fase 1: análise de correção (índice 14 + renumeração)…');
    const analiseOpts = {
      base: opts.base,
      clienteMin: opts.clienteMin,
      clienteMax: opts.clienteMax,
      filtroClienteCod: opts.clienteFiltro,
      filtroProcesso: opts.processoFiltro,
      contagensPath: opts.contagensPath,
      dryRun: true,
    };
    const analise = executarAnaliseHistoricoLocal(analiseOpts);
    imprimirRelatorioAnaliseCorrecao(analise);

    if (!opts.aplicarCorrecao) {
      console.log(
        '[txt] Nenhum ficheiro foi alterado. Para aplicar a correção e continuar a importação, use --aplicar-correcao'
      );
      if (opts.somenteCorrigir) process.exit(0);
      process.exit(0);
    }

    console.log('\n[txt] A aplicar correção nos ficheiros (--aplicar-correcao)…');
    const { stats: corrStats } = executarCorrecaoHistoricoLocal({ ...analiseOpts, dryRun: false });
    console.log('[txt] Correção aplicada:', JSON.stringify(corrStats));
    if (opts.somenteCorrigir) {
      console.log('[txt] --somente-corrigir: fim (sem importação).');
      process.exit(0);
    }
  }

  console.log('\n[txt] Fase 2: leitura e importação…');
  console.log(`[txt] base=${opts.base}`);
  console.log(`[txt] clientes ${opts.clienteMin}–${opts.clienteMax}`);

  const entradas = coletarEntradasHistoricoLocal({
    base: opts.base,
    clienteMin: opts.clienteMin,
    clienteMax: opts.clienteMax,
    contagensPath: opts.contagensPath,
    limiteEntradas: opts.limiteEntradas,
    filtroClienteCod: opts.clienteFiltro,
    filtroProcesso: opts.processoFiltro,
  });

  const stats = {
    entradasLidas: entradas.length,
    comData: entradas.filter((e) => e.dataBruta).length,
    semData: entradas.filter((e) => !e.dataBruta).length,
  };
  console.log('[txt] entradas a importar:', JSON.stringify(stats));

  if (entradas.length === 0) {
    console.warn('[txt] Nenhuma entrada — verifique base, intervalo de clientes ou sincronização Dropbox.');
    process.exit(0);
  }

  const { rows } = entradasParaLinhasPlanilha(entradas);

  let xlsPath = opts.gerarXls;
  if (!xlsPath) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vilareal-hist-txt-'));
    xlsPath = path.join(tmpDir, 'historico-local-import.xls');
  }
  const gravado = gravarPlanilhaHistorico(xlsPath, rows);
  console.log(`[txt] Planilha intermédia: ${gravado} (${rows.length} linhas)`);

  if (opts.gerarXls && opts.dryRun) {
    console.log('[txt] --gerar-xls com --dry-run: só gravou a planilha, sem API.');
    process.exit(0);
  }

  if (opts.gerarXls && !opts.importArgv.includes('--dry-run') && !process.env.VILAREAL_IMPORT_SENHA) {
    console.log('[txt] Planilha gerada. Para importar:');
    console.log(`  VILAREAL_IMPORT_SENHA='…' node scripts/import-historico-planilha.mjs "${gravado}" --login=itamar --origem=${ORIGEM_PADRAO_TXT}`);
    process.exit(0);
  }

  if (!opts.gerarXls && opts.dryRun) {
    opts.importArgv.push('--dry-run');
  }

  console.log('[txt] A invocar import-historico-planilha.mjs (POST na API)…');
  const childArgs = [IMPORT_PLANILHA_SCRIPT, gravado, ...opts.importArgv];
  const r = spawnSync(process.execPath, childArgs, {
    stdio: 'inherit',
    env: process.env,
    cwd: path.join(__dirname, '..'),
  });

  if (!opts.gerarXls) {
    try {
      fs.unlinkSync(gravado);
      fs.rmdirSync(path.dirname(gravado));
    } catch {
      /* temp opcional */
    }
  }

  process.exit(r.status ?? 1);
}

main();
