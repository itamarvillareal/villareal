#!/usr/bin/env node
/**
 * Lê ficheiros de histórico locais (txt, uma linha) na árvore Dropbox «Banco de Dados»
 * e gera uma planilha (.xls) no layout esperado por `import-historico-planilha.mjs`:
 *   A = código cliente (8 dígitos), B = nº interno do processo, D = informação,
 *   E = data (dd/mm/aaaa ou ISO), F = utilizador.
 *
 * Raiz por defeito: /Users/itamar/Dropbox/Banco de Dados
 * Tenta sempre, por ordem: «HC» e «Historico de Consultas Inativos».
 * Fluxo por entrada: índice **14** → data **16** (prioridade `Ano/aaaa/mm`, depois mil) →
 * **15** / **17** nas pastas `Ano` do ano/mês do ficheiro de data (ou inferido da linha); cliente **728** em `1000/700/`.
 *
 * Uso:
 *   node scripts/extrair-historico-local-txt-para-xls.mjs
 *   node scripts/extrair-historico-local-txt-para-xls.mjs --base="/Users/itamar/Dropbox/Banco de Dados" --out="/tmp/historico.xls"
 *   node scripts/extrair-historico-local-txt-para-xls.mjs --cliente-min=1 --cliente-max=50 --verbose
 *   node scripts/extrair-historico-local-txt-para-xls.mjs --contagens="/tmp/max-proc-por-cliente.json"
 *
 * JSON de contagens (opcional): objeto { "1": 120, "728": 1640, "00000042": 3 }
 * — valor = maior nº de processo (col. B) a tentar para esse cliente (inclusive).
 * Sem ficheiro: por defeito 999 para todos, exceto cliente 728 → 1640.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import XLSX from 'xlsx';
import {
  DEFAULT_BASE_HISTORICO_LOCAL,
  MAX_CLIENTE_HISTORICO_LOCAL,
  carregarContagensOpcional,
  formatCod8,
  formatProcNomeArquivo,
  lerMaxIndiceHistorico,
  maxProcParaCliente,
} from './lib/historico-local-txt-paths.mjs';
import { lerConteudoEntradaHistorico } from './lib/historico-local-txt-entrada.mjs';

const DEFAULT_BASE = DEFAULT_BASE_HISTORICO_LOCAL;
const MAX_CLIENTE = MAX_CLIENTE_HISTORICO_LOCAL;

function parseArgs(argv) {
  const out = {
    base: DEFAULT_BASE,
    out: path.join(process.cwd(), 'historico-extraido-local.xls'),
    clienteMin: 1,
    clienteMax: MAX_CLIENTE,
    contagensPath: null,
    verbose: false,
    limiteLinhas: 0,
  };
  for (const a of argv) {
    if (a === '--verbose' || a === '-v') out.verbose = true;
    else if (a.startsWith('--base=')) out.base = path.resolve(a.slice(7));
    else if (a.startsWith('--out=')) out.out = path.resolve(a.slice(6));
    else if (a.startsWith('--cliente-min=')) out.clienteMin = Math.max(1, Number(a.slice(14)) || 1);
    else if (a.startsWith('--cliente-max='))
      out.clienteMax = Math.min(MAX_CLIENTE, Number(a.slice('--cliente-max='.length)) || MAX_CLIENTE);
    else if (a.startsWith('--contagens=')) out.contagensPath = path.resolve(a.slice(12));
    else if (a.startsWith('--limite-linhas=')) out.limiteLinhas = Math.max(0, Number(a.slice(16)) || 0);
  }
  if (out.clienteMin > out.clienteMax) {
    const t = out.clienteMin;
    out.clienteMin = out.clienteMax;
    out.clienteMax = t;
  }
  return out;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const contagens = carregarContagensOpcional(opts.contagensPath);
  const stats = {
    clientesVisitados: 0,
    procsComIndice: 0,
    procsSemFicheiroIndice: 0,
    linhasEmitidas: 0,
    linhasIgnoradasRegra: 0,
    ficheirosDataAusente: 0,
  };

  /** @type {(string|number|null)[][]} */
  const rows = [];
  /** Sem linha de cabeçalho textual — compatível com `import-historico-planilha` (col. A = código). */

  outer: for (let cod = opts.clienteMin; cod <= opts.clienteMax; cod += 1) {
    const cod8 = formatCod8(cod);
    const maxProc = maxProcParaCliente(cod, contagens);
    stats.clientesVisitados += 1;

    for (let proc = 1; proc <= maxProc; proc += 1) {
      const procStr = formatProcNomeArquivo(proc);
      if (!procStr) continue;

      const maxIdx = lerMaxIndiceHistorico(opts.base, cod8, cod, procStr);
      if (maxIdx == null) {
        stats.procsSemFicheiroIndice += 1;
        continue;
      }
      stats.procsComIndice += 1;

      for (let i = 1; i <= maxIdx; i += 1) {
        if (opts.limiteLinhas > 0 && stats.linhasEmitidas >= opts.limiteLinhas) {
          console.warn(`[limite] Atingido --limite-linhas=${opts.limiteLinhas} — parando.`);
          break outer;
        }
        const c = lerConteudoEntradaHistorico(opts.base, cod8, cod, procStr, i);
        if (!c.dataTrim) stats.ficheirosDataAusente += 1;

        /* 1) data e informação vazias → ignorar. 2) data existente sem informação → ignorar. 3) informação sem utilizador → gravar (com ou sem data). */
        if (!c.infoTrim && !c.dataTrim) {
          stats.linhasIgnoradasRegra += 1;
          continue;
        }
        if (c.dataTrim && !c.infoTrim) {
          stats.linhasIgnoradasRegra += 1;
          continue;
        }

        rows.push([cod8, proc, '', c.infoTrim, c.dataTrim || '', c.userTrim || '']);
        stats.linhasEmitidas += 1;

        if (opts.verbose && stats.linhasEmitidas <= 5) {
          console.log(
            `[linha] ${cod8} proc=${proc} idx=${c.idx4} data="${c.dataTrim}" infoLen=${c.infoTrim.length} user="${c.userTrim}"`
          );
        }
      }
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Planilha2');

  const outPath = opts.out.endsWith('.xls') ? opts.out : opts.out.replace(/\.xlsx?$/i, '') + '.xls';
  try {
    XLSX.writeFile(wb, outPath, { bookType: 'biff8' });
  } catch (e) {
    console.warn('[xls] Falha biff8, a gravar .xlsx:', e?.message || e);
    const alt = outPath.replace(/\.xls$/i, '.xlsx');
    XLSX.writeFile(wb, alt, { bookType: 'xlsx' });
    console.log(`[saida] Gravado: ${alt}`);
    console.log(stats);
    console.log(
      '\nResumo: clientes=%d | procs c/ índice=%d | procs s/ ficheiro índice=%d | linhas planilha=%d | ignoradas regra=%d',
      stats.clientesVisitados,
      stats.procsComIndice,
      stats.procsSemFicheiroIndice,
      stats.linhasEmitidas,
      stats.linhasIgnoradasRegra
    );
    process.exit(0);
  }

  console.log(`[saida] Gravado: ${outPath}`);
  console.log(JSON.stringify(stats, null, 2));
  console.log(
    '\nPróximo passo (import API):\n  node scripts/import-historico-planilha.mjs "' +
      outPath +
      '" --login=… --nao-limpar-import --apenas-novos\n'
  );
}

main();
