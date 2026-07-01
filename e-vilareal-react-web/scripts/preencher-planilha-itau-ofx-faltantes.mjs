#!/usr/bin/env node
/**
 * Acrescenta à aba Itaú da planilha apenas lançamentos OFX ausentes (match semântico).
 *
 * Por defeito usa OFX 2026 (1222 + 1213) e só linhas a partir da última data da planilha.
 * Não altera linhas existentes; recalcula col I com fórmula =I{n-1}+H{n}.
 *
 * Uso:
 *   node scripts/preencher-planilha-itau-ofx-faltantes.mjs --dry-run
 *   node scripts/preencher-planilha-itau-ofx-faltantes.mjs --executar --saida=~/Downloads/Extratos Bancos - Itamar-ofx.xls
 *
 * Envs: VILAREAL_EXTRATO_BANCOS_XLS
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

import XLSX from 'xlsx';

import {
  COL_USUARIO,
  LAYOUTS_EXTRATO_BANCO,
  extrairLancamentosDaAba,
} from './lib/extrato-bancos-planilha-layouts.mjs';
import { requireExtratoBancosPlanilhaXlsPath } from './lib/resolve-extrato-bancos-planilha-xls.mjs';
import { dataLancamentoParaIso, listarChavesSemanticasLancamento, parseOfxToExtrato } from '../src/utils/ofx.js';

const OFX_DEFAULT = [
  path.join(os.homedir(), 'Downloads', 'Extrato Conta Corrente-300620261222.ofx'),
  path.join(os.homedir(), 'Downloads', 'Extrato Conta Corrente-300620261213.ofx'),
];

function expandPath(p) {
  const s = String(p ?? '').trim();
  if (!s) return '';
  return s.startsWith('~/') ? path.join(os.homedir(), s.slice(2)) : path.resolve(s);
}

function parseArgs(argv) {
  const out = {
    planilha: '',
    saida: '',
    ofxPaths: [],
    executar: false,
    incluirAntesUltimaData: false,
    letra: 'N',
  };
  for (const a of argv) {
    if (a === '--executar') out.executar = true;
    else if (a === '--dry-run') out.executar = false;
    else if (a === '--incluir-antes-ultima-data') out.incluirAntesUltimaData = true;
    else if (a.startsWith('--planilha=')) out.planilha = expandPath(a.slice(11));
    else if (a.startsWith('--saida=')) out.saida = expandPath(a.slice(8));
    else if (a.startsWith('--ofx=')) out.ofxPaths.push(expandPath(a.slice(6)));
    else if (a.startsWith('--letra=')) out.letra = a.slice(8).trim().toUpperCase().slice(0, 1) || 'N';
  }
  if (!out.ofxPaths.length) out.ofxPaths = OFX_DEFAULT.filter((p) => fs.existsSync(p));
  return out;
}

function consumirSemantico(map, t) {
  for (const k of listarChavesSemanticasLancamento(t)) {
    const n = map.get(k) || 0;
    if (n > 0) {
      if (n === 1) map.delete(k);
      else map.set(k, n - 1);
      return true;
    }
  }
  return false;
}

function construirMapaSemanticoPlanilha(plan) {
  const map = new Map();
  for (const p of plan) {
    const t = { data: p.dataIso, valor: p.valor, descricao: p.descricao };
    for (const k of listarChavesSemanticasLancamento(t)) {
      map.set(k, (map.get(k) || 0) + 1);
    }
  }
  return map;
}

function carregarOfxDedup(ofxPaths) {
  /** @type {Array<Record<string, unknown>>} */
  const out = [];
  const seen = new Set();
  for (const fp of ofxPaths) {
    if (!fs.existsSync(fp)) {
      console.warn(`OFX não encontrado (ignorado): ${fp}`);
      continue;
    }
    const rows = parseOfxToExtrato(fs.readFileSync(fp, 'utf8'));
    for (const r of rows) {
      const iso = dataLancamentoParaIso(r.data);
      const key = `${String(r.numero ?? '').trim()}|${iso}|${Math.round(Number(r.valor) * 100)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ ...r, dataIso: iso });
    }
  }
  out.sort((a, b) => {
    const da = a.dataIso || '';
    const db = b.dataIso || '';
    if (da !== db) return da.localeCompare(db);
    return Number(a.valor) - Number(b.valor);
  });
  return out;
}

function isoToLocalDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''));
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function ultimoContadorColC(ws, startRow0) {
  let last = 0;
  const { e } = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let r = startRow0; r <= e.r; r += 1) {
    const v = ws[XLSX.utils.encode_cell({ r, c: 2 })]?.v;
    if (typeof v === 'number' && Number.isFinite(v) && v > last) last = Math.trunc(v);
  }
  return last;
}

function saldoColIEmLinha(ws, row0) {
  const v = ws[XLSX.utils.encode_cell({ r: row0, c: 8 })]?.v;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function definirCelula(ws, r, c, value, formula) {
  const ref = XLSX.utils.encode_cell({ r, c });
  if (formula) {
    ws[ref] = { t: 'n', f: formula };
    return;
  }
  if (value instanceof Date) {
    ws[ref] = { t: 'd', v: value };
    return;
  }
  if (typeof value === 'number') {
    ws[ref] = { t: 'n', v: value };
    return;
  }
  ws[ref] = { t: 's', v: String(value ?? '') };
}

function fmtBrl(n) {
  return (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const planPath = requireExtratoBancosPlanilhaXlsPath(opts.planilha || null);
  const wb = XLSX.readFile(planPath, { cellDates: true, cellFormula: true });
  const ws = wb.Sheets['Itaú'];
  if (!ws) throw new Error('Aba Itaú não encontrada');

  const layout = LAYOUTS_EXTRATO_BANCO['itau-pf'];
  const plan = extrairLancamentosDaAba(ws, layout, 'Itaú');
  if (!plan.length) throw new Error('Nenhum lançamento na aba Itaú');

  const ultimaData = plan[plan.length - 1].dataIso;
  const ultimaLinhaExcel = plan[plan.length - 1].linhaExcel;
  const saldoAntes = saldoColIEmLinha(ws, ultimaLinhaExcel - 1);

  const map = construirMapaSemanticoPlanilha(plan);
  const ofxRows = carregarOfxDedup(opts.ofxPaths);

  /** @type {typeof ofxRows} */
  const faltantes = [];
  for (const r of ofxRows) {
    const t = { data: r.data, valor: r.valor, descricao: r.descricao };
    if (!consumirSemantico(map, t)) faltantes.push(r);
  }

  const paraAppend = opts.incluirAntesUltimaData
    ? faltantes
    : faltantes.filter((r) => (r.dataIso || '') >= ultimaData);

  const mov = paraAppend.reduce((s, r) => s + (Number(r.valor) || 0), 0);
  const saldoDepois = saldoAntes != null ? saldoAntes + mov : null;

  console.log('=== Preencher planilha Itaú — OFX faltantes ===\n');
  console.log(`Planilha:     ${planPath}`);
  console.log(`OFX:          ${opts.ofxPaths.map((p) => path.basename(p)).join(', ') || '(nenhum)'}`);
  console.log(`Planilha:     ${plan.length} lanç. até ${ultimaData} (linha ${ultimaLinhaExcel})`);
  console.log(`Saldo col I:  ${saldoAntes != null ? fmtBrl(saldoAntes) : '?'}`);
  console.log(`OFX dedup:    ${ofxRows.length}`);
  console.log(`Faltantes:    ${faltantes.length} (total OFX − planilha)`);
  console.log(`A acrescentar: ${paraAppend.length} linhas (mov ${fmtBrl(mov)})`);
  if (saldoDepois != null) {
    console.log(`Saldo final:  ${fmtBrl(saldoDepois)} (= col I + movimento)`);
  }
  if (!opts.incluirAntesUltimaData && faltantes.length > paraAppend.length) {
    console.log(
      `\n(Omitidos ${faltantes.length - paraAppend.length} faltantes anteriores a ${ultimaData} — provável troca de chave/formato; use --incluir-antes-ultima-data para incluir.)`,
    );
  }

  if (!paraAppend.length) {
    console.log('\nNada a acrescentar.');
    return;
  }

  console.log('\nAmostra (primeiras 3):');
  for (const r of paraAppend.slice(0, 3)) {
    console.log(`  ${r.dataIso}  ${fmtBrl(r.valor).padStart(14)}  ${String(r.descricao ?? '').slice(0, 55)}`);
  }
  console.log('Amostra (últimas 3):');
  for (const r of paraAppend.slice(-3)) {
    console.log(`  ${r.dataIso}  ${fmtBrl(r.valor).padStart(14)}  ${String(r.descricao ?? '').slice(0, 55)}`);
  }

  if (!opts.executar) {
    console.log('\nDry-run — use --executar --saida=/caminho/arquivo.xls para gravar.');
    return;
  }

  const saida =
    opts.saida ||
    planPath.replace(/\.xls$/i, `-ofx-${new Date().toISOString().slice(0, 10)}.xls`);

  const startRow0 = layout.primeiraLinhaExcel - 1;
  let nextRow0 = ultimaLinhaExcel;
  let seqC = ultimoContadorColC(ws, startRow0);

  const U = COL_USUARIO;
  for (const r of paraAppend) {
    seqC += 1;
    const excelRow = nextRow0 + 1;
    const prevRow = excelRow - 1;

    definirCelula(ws, nextRow0, U.letra, opts.letra);
    definirCelula(ws, nextRow0, 2, seqC);
    definirCelula(ws, nextRow0, U.data, isoToLocalDate(r.dataIso));
    definirCelula(ws, nextRow0, U.descricao, String(r.descricao ?? 'Lançamento OFX').slice(0, 255));
    definirCelula(ws, nextRow0, U.valor, Number(r.valor) || 0);
    definirCelula(ws, nextRow0, 8, null, `I${prevRow}+H${excelRow}`);

    const obs = [
      r.descricaoDetalhada ? String(r.descricaoDetalhada).trim() : '',
      r.numero ? `FITID ${r.numero}` : '',
    ]
      .filter(Boolean)
      .join(' · ')
      .slice(0, 500);
    if (obs) definirCelula(ws, nextRow0, U.observacao, obs);

    nextRow0 += 1;
  }

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  range.e.r = Math.max(range.e.r, nextRow0 - 1);
  ws['!ref'] = XLSX.utils.encode_range(range);

  if (saida === planPath) {
    const backup = `${planPath}.bak-${new Date().toISOString().replace(/[:.]/g, '').slice(0, 15)}`;
    fs.copyFileSync(planPath, backup);
    console.log(`\nBackup: ${backup}`);
  }

  XLSX.writeFile(wb, saida, { bookType: 'biff8' });
  console.log(`Gravado: ${saida} (+${paraAppend.length} linhas)`);
}

main();
