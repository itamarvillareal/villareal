#!/usr/bin/env node
/**
 * Rankeia processos pelo volume de informação em txt (parsers VB corretos).
 *
 *   node scripts/rankear-processos-txt-completos.mjs --top=15
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  centenaPastaClienteHistorico,
  formatCod8,
  formatProcNomeArquivo,
  lerMaxIndiceHistorico,
  pastaNumeroClienteHistorico,
  PREFIXOS,
  SEGMENTO_MIL,
} from './lib/historico-local-txt-paths.mjs';
import { listarProcessosHistoricoCliente } from './lib/historico-local-txt-correcao.mjs';
import {
  MAPA_TIPO_NUMERICO_VB,
  caminhoArquivoTipoNumerico,
} from './lib/proc-processo-cabecalho-txt.mjs';
import {
  parseNomeArquivoSemanticProcesso,
  SEMANTIC_KEYS,
} from './lib/proc-processo-semantic-txt.mjs';
import {
  caminhoObservacaoFaseEsperado,
  caminhoStatusProcessoEsperado,
  parseNomeArquivoCodTipoProc,
  parseNomeArquivoFase21_1,
  resolverBaseBancoDados,
} from './lib/gerais-fase-processo-txt.mjs';
import { parseNomeArquivoImovelVinculo0891 } from './lib/proc-imovel-vinculo-txt.mjs';

function parseArgs(argv) {
  const out = {
    top: 15,
    clienteMin: 1,
    clienteMax: 999,
    base: resolverBaseBancoDados(),
    json: null,
  };
  for (const a of argv) {
    if (a.startsWith('--top=')) out.top = Math.max(1, Number(a.slice(6)) || 15);
    else if (a.startsWith('--cliente-min=')) out.clienteMin = Math.max(1, Number(a.slice(14)) || 1);
    else if (a.startsWith('--cliente-max=')) out.clienteMax = Math.min(999, Number(a.slice(14)) || 999);
    else if (a.startsWith('--base=')) out.base = path.resolve(a.slice(7));
    else if (a.startsWith('--json=')) out.json = path.resolve(a.slice(7));
  }
  return out;
}

/** @param {string} dir */
function listarClientesNaPastaMil(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = new Set();
  for (const cent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!cent.isDirectory()) continue;
    for (const cli of fs.readdirSync(path.join(dir, cent.name), { withFileTypes: true })) {
      if (!cli.isDirectory()) continue;
      const n = Number.parseInt(cli.name, 10);
      if (Number.isFinite(n) && n >= 1) out.add(n);
    }
  }
  return [...out];
}

/**
 * @param {string} dirCliente
 * @param {number} codNum
 * @returns {Set<number>}
 */
function procsDeArquivosCliente(dirCliente, codNum) {
  const procs = new Set();
  if (!fs.existsSync(dirCliente)) return procs;

  let files;
  try {
    files = fs.readdirSync(dirCliente);
  } catch {
    return procs;
  }

  for (const f of files) {
    if (!f.endsWith('.txt')) continue;
    for (const tipo of Object.keys(MAPA_TIPO_NUMERICO_VB)) {
      const p = parseNomeArquivoCodTipoProc(f, tipo);
      if (p?.codNum === codNum) procs.add(p.numeroInterno);
    }
    for (const seg of Object.values(SEMANTIC_KEYS)) {
      const p = parseNomeArquivoSemanticProcesso(f, seg);
      if (p?.codNum === codNum) procs.add(p.numeroInterno);
    }
    const im = parseNomeArquivoImovelVinculo0891(f);
    if (im?.codNum === codNum) procs.add(im.numeroInterno);
  }
  return procs;
}

/**
 * @param {string} baseFase
 * @param {number} codNum
 * @returns {Set<number>}
 */
function procsComFase(baseFase, codNum) {
  const procs = new Set();
  if (!fs.existsSync(baseFase)) return procs;

  function walk(d) {
    let entries;
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const abs = path.join(d, ent.name);
      if (ent.isDirectory()) {
        walk(abs);
        continue;
      }
      const p = parseNomeArquivoFase21_1(ent.name);
      if (p?.codNum === codNum) procs.add(p.numeroInterno);
    }
  }
  walk(baseFase);
  return procs;
}

/**
 * Índice máximo do histórico (tipo 14 ou inferido pelos 16).
 * @param {string} baseBanco — raiz «Banco de Dados»
 */
function maxIndiceHistorico(baseBanco, codNum, proc) {
  const cod8 = formatCod8(codNum);
  const procStr = formatProcNomeArquivo(proc);
  const n = lerMaxIndiceHistorico(baseBanco, cod8, codNum, procStr);
  return n != null && n >= 1 ? n : 0;
}

function scoreCabecalho(codNum, proc, base) {
  let n = 0;
  const baseProc = path.join(base, 'Proc', SEGMENTO_MIL);
  const baseGer = path.join(base, 'Gerais', SEGMENTO_MIL);
  for (const [tipo, meta] of Object.entries(MAPA_TIPO_NUMERICO_VB)) {
    const baseMil = meta.pasta === 'proc' ? baseProc : baseGer;
    const abs = caminhoArquivoTipoNumerico(baseMil, codNum, proc, tipo);
    if (abs && fs.existsSync(abs)) n += 1;
  }
  return n;
}

function scoreExtras(codNum, proc, base) {
  let n = 0;
  const cod8 = formatCod8(codNum);
  const procStr = formatProcNomeArquivo(proc);
  const baseGeraisMil = path.join(base, 'Gerais', SEGMENTO_MIL);
  const cent = String(centenaPastaClienteHistorico(codNum));
  const pasta = pastaNumeroClienteHistorico(codNum);

  const st = caminhoStatusProcessoEsperado(baseGeraisMil, codNum, proc);
  if (st && fs.existsSync(st)) n += 1;
  const obs = caminhoObservacaoFaseEsperado(baseGeraisMil, codNum, proc);
  if (obs && fs.existsSync(obs)) n += 1;

  for (const seg of Object.values(SEMANTIC_KEYS)) {
    const nome = `${cod8}.${seg}.Processo${procStr}.Processos.txt`;
    const pProc = path.join(base, 'Proc', SEGMENTO_MIL, cent, pasta, nome);
    const pGer = path.join(baseGeraisMil, cent, pasta, nome);
    if (fs.existsSync(pProc) || fs.existsSync(pGer)) n += 1;
  }

  const imovel = path.join(base, 'Proc', SEGMENTO_MIL, cent, pasta, `${cod8}.0.89.1.${procStr}.txt`);
  if (fs.existsSync(imovel)) n += 1;

  return n;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const base = opts.base;

  const clientes = new Set();
  for (const sub of ['Proc', 'Gerais', 'HC']) {
    for (const c of listarClientesNaPastaMil(path.join(base, sub, SEGMENTO_MIL))) {
      if (c >= opts.clienteMin && c <= opts.clienteMax) clientes.add(c);
    }
  }

  /** @type {object[]} */
  const lista = [];

  for (const codNum of [...clientes].sort((a, b) => a - b)) {
    const cent = String(centenaPastaClienteHistorico(codNum));
    const pasta = pastaNumeroClienteHistorico(codNum);
    const dirProc = path.join(base, 'Proc', SEGMENTO_MIL, cent, pasta);
    const dirGer = path.join(base, 'Gerais', SEGMENTO_MIL, cent, pasta);

    const procs = new Set([
      ...listarProcessosHistoricoCliente(base, codNum),
      ...procsDeArquivosCliente(dirProc, codNum),
      ...procsDeArquivosCliente(dirGer, codNum),
      ...procsComFase(path.join(base, 'fase'), codNum),
    ]);

    for (const proc of procs) {
      const maxIdx = maxIndiceHistorico(base, codNum, proc);
      const cab = scoreCabecalho(codNum, proc, base);
      const ext = scoreExtras(codNum, proc, base);
      const score = maxIdx * 8 + cab * 3 + ext * 4;
      if (score < 5) continue;

      lista.push({
        codigoCliente: codNum,
        cod8: formatCod8(codNum),
        numeroInterno: proc,
        maxIndiceHistorico: maxIdx,
        tiposCabecalho: cab,
        extras: ext,
        score,
      });
    }
  }

  lista.sort((a, b) => b.score - a.score || b.maxIndiceHistorico - a.maxIndiceHistorico);
  const top = lista.slice(0, opts.top);

  console.log(`\n=== Top ${top.length} processos (mais informação em txt) ===\n`);
  console.log('Cliente  Proc   Idx   Cab  Ext  Score');
  console.log('-'.repeat(40));
  for (const r of top) {
    console.log(
      `${String(r.codigoCliente).padEnd(7)} ${String(r.numeroInterno).padStart(5)} ${String(r.maxIndiceHistorico).padStart(5)} ${String(r.tiposCabecalho).padStart(4)} ${String(r.extras).padStart(4)} ${String(r.score).padStart(6)}`
    );
  }

  console.log('\nCandidatos a teste (--dry-run):');
  for (const r of top.slice(0, Math.max(10, top.length))) {
    console.log(
      `  node scripts/import-processo-txt.mjs --cliente=${r.codigoCliente} --processo=${r.numeroInterno} --dry-run`
    );
  }

  if (opts.json) {
    fs.writeFileSync(opts.json, JSON.stringify({ geradoEm: new Date().toISOString(), top }, null, 2), 'utf8');
    console.log(`\nJSON: ${opts.json}`);
  }
}

main();
