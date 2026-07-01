#!/usr/bin/env node
/**
 * Opção C: rastreia gap planilha/DB vs banco (OFX Itaú 9664007474).
 *
 * Uso:
 *   node scripts/rastrear-gap-extrato-historico.mjs
 *   node scripts/rastrear-gap-extrato-historico.mjs --ofx=/path/a.ofx --ofx=/path/b.ofx
 *   node scripts/rastrear-gap-extrato-historico.mjs --saldo-banco-hoje=-1976.73
 */
import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';

import './lib/load-vilareal-import-env.mjs';
import { parseOfxToExtrato, dataLancamentoParaIso } from '../src/utils/ofx.js';
import { extrairMetadadosOfx } from '../src/components/financeiro/extrato/extratoRepararDiagnosticoCore.js';
import {
  agregarDbPorMes,
  agregarPlanilhaPorMes,
  compararMeses,
  extrairLinhasPlanilhaBanco,
  fetchTodosLancamentosBanco,
} from './lib/extrato-bancos-planilha-validacao.mjs';

const ITAU_ACCT = '9664007474';
const PLANILHA = '/Users/itamar/Dropbox/sistema/Extratos Bancos - Itamar.xls';
const OFX_DEFAULT_DIRS = [
  '/Users/itamar/Downloads',
  '/Users/itamar/Dropbox/pasta sem título 2',
];

function parseArgs(argv) {
  const out = {
    saldoBancoHoje: -1976.73,
    ofxPaths: [],
    baseUrl: (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, ''),
  };
  for (const a of argv) {
    if (a.startsWith('--ofx=')) out.ofxPaths.push(a.slice(6).trim());
    else if (a.startsWith('--saldo-banco-hoje=')) out.saldoBancoHoje = Number(a.slice(19));
    else if (a.startsWith('--base-url=')) out.baseUrl = a.slice(11).replace(/\/$/, '');
  }
  return out;
}

function parseSaldo(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  const s = String(v).trim().replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseDataIso(raw) {
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  const s = String(raw ?? '').trim();
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

function saldoPlanilhaEm(ws, e, iso) {
  let last = null;
  for (let r = 6; r <= e.r; r += 1) {
    const d = parseDataIso(ws[XLSX.utils.encode_cell({ r, c: 3 })]?.v);
    if (!d || d > iso) break;
    const s = parseSaldo(ws[XLSX.utils.encode_cell({ r, c: 8 })]?.v);
    if (s != null) last = s;
  }
  return last;
}

function movOfxPorMes(rows) {
  const map = new Map();
  for (const r of rows) {
    const iso = dataLancamentoParaIso(r.data);
    if (!iso) continue;
    const mes = iso.slice(0, 7);
    map.set(mes, (map.get(mes) ?? 0) + (Number(r.valor) || 0));
  }
  return map;
}

function fmt(n) {
  return (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function listarOfxItau(extraPaths) {
  const found = new Set(extraPaths);
  for (const dir of OFX_DEFAULT_DIRS) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.toLowerCase().endsWith('.ofx')) continue;
      const fp = path.join(dir, f);
      try {
        if (fs.readFileSync(fp, 'utf8').includes(ITAU_ACCT)) found.add(fp);
      } catch {
        /* ignore */
      }
    }
  }
  return [...found].sort();
}

const opts = parseArgs(process.argv.slice(2));
// Sempre localhost para rastreio local (evita .env.import.local → produção).
opts.baseUrl = opts.baseUrl.includes('localhost') ? opts.baseUrl : 'http://localhost:8080';
const wb = XLSX.readFile(PLANILHA, { cellDates: true, cellNF: false });
const ws = wb.Sheets['Itaú'];
const { e } = XLSX.utils.decode_range(ws['!ref']);
const { linhas } = extrairLinhasPlanilhaBanco(wb, 'Itaú', { desde: '2014-01-01' });
const planPorMes = agregarPlanilhaPorMes(linhas);

const loginRes = await fetch(`${opts.baseUrl}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ login: 'itamar', senha: process.env.VILAREAL_IMPORT_SENHA }),
});
const { accessToken } = await loginRes.json();
const headers = { Authorization: `Bearer ${accessToken}` };
const db = await fetchTodosLancamentosBanco(accessToken, opts.baseUrl, 1);
const dbPorMes = agregarDbPorMes(db);
const gapsPlanDb = compararMeses(planPorMes, dbPorMes).filter((g) => g.mes < '2026-01');

console.log('=== Opção C: rastreio histórico Itaú ===\n');
console.log(`Planilha × DB (2014–2025): ${gapsPlanDb.length === 0 ? 'OK ✓' : `${gapsPlanDb.length} mês(es) com gap`}`);
if (gapsPlanDb.length) {
  for (const g of gapsPlanDb.slice(0, 10)) {
    console.log(`  ${g.mes}: plan ${g.planQtd}/${fmt(g.planSaldo)}  db ${g.dbQtd}/${fmt(g.dbSaldo)}`);
  }
}

const saldoSys2512 = Number(
  (
    await (
      await fetch(`${opts.baseUrl}/api/financeiro/lancamentos/saldo-banco?numeroBanco=1&data=2025-12-31`, {
        headers,
      })
    ).json()
  ).saldo,
);
const saldoSysHoje = Number(
  (await (await fetch(`${opts.baseUrl}/api/financeiro/lancamentos/saldo-banco?numeroBanco=1`, { headers })).json())
    .saldo,
);
const mov2026Ofx = [...parseOfxToExtrato(fs.readFileSync('/Users/itamar/Downloads/Extrato Conta Corrente-300620261222.ofx', 'utf8')), ...parseOfxToExtrato(fs.readFileSync('/Users/itamar/Downloads/Extrato Conta Corrente-300620261213.ofx', 'utf8'))]
  .filter((r) => dataLancamentoParaIso(r.data)?.startsWith('2026'))
  .reduce((s, r) => s + (Number(r.valor) || 0), 0);
const bank2512 = opts.saldoBancoHoje - mov2026Ofx;

console.log('\n=== Checkpoint 31/12/2025 ===');
console.log(`Planilha col I:     ${fmt(0)}`);
console.log(`Sistema API:        ${fmt(saldoSys2512)}`);
console.log(`Banco real (deriv.): ${fmt(bank2512)}`);
console.log(`Gap planilha−banco: ${fmt(0 - bank2512)}`);

// Mesclar OFX Itaú disponíveis
const ofxFiles = listarOfxItau(opts.ofxPaths);
const movOfxAll = new Map();
const checkpoints = [];

for (const fp of ofxFiles) {
  const txt = fs.readFileSync(fp, 'utf8');
  if (!txt.includes(ITAU_ACCT)) continue;
  const meta = extrairMetadadosOfx(txt);
  const rows = parseOfxToExtrato(txt);
  for (const [mes, v] of movOfxPorMes(rows)) {
    movOfxAll.set(mes, (movOfxAll.get(mes) ?? 0) + v);
  }
  const sum = rows.reduce((s, r) => s + (Number(r.valor) || 0), 0);
  const d0 = new Date(`${meta.dataInicio}T12:00:00Z`);
  d0.setUTCDate(d0.getUTCDate() - 1);
  const vespera = d0.toISOString().slice(0, 10);
  checkpoints.push({
    file: path.basename(fp),
    inicio: meta.dataInicio,
    fim: meta.dataFim,
    txs: rows.length,
    sum,
    ledger: meta.saldoLedger,
    planVespera: saldoPlanilhaEm(ws, e, vespera),
    sysVespera: Number(
      (
        await (
          await fetch(`${opts.baseUrl}/api/financeiro/lancamentos/saldo-banco?numeroBanco=1&data=${vespera}`, {
            headers,
          })
        ).json()
      ).saldo,
    ),
  });
}

console.log(`\n=== OFX Itaú disponíveis: ${ofxFiles.length} arquivo(s) ===`);
const mesesOfx = [...movOfxAll.keys()].sort();
const primeiroOfx = mesesOfx[0] ?? '—';
console.log(`Cobertura movimento OFX: ${primeiroOfx} → ${mesesOfx.at(-1) ?? '—'}`);

if (primeiroOfx > '2014-01') {
  console.log(
    `\n⚠ Sem OFX Itaú antes de ${primeiroOfx}. Para localizar os ${fmt(0 - bank2512).replace('R$', 'R$')} no histórico, exporte extratos OFX de 2014–2025 (ex.: um arquivo por ano).`,
  );
}

console.log('\n=== Movimento mensal: planilha vs OFX (meses com OFX) ===');
let firstMovGap = null;
for (const mes of mesesOfx) {
  const mp = planPorMes.get(mes)?.saldo ?? 0;
  const mo = movOfxAll.get(mes) ?? 0;
  const diff = Math.round((mp - mo) * 100) / 100;
  if (Math.abs(diff) >= 0.01) {
    if (!firstMovGap) firstMovGap = { mes, mp, mo, diff };
    console.log(`  ${mes}  plan ${fmt(mp)}  ofx ${fmt(mo)}  Δ ${fmt(diff)}`);
  }
}
if (!firstMovGap) {
  console.log('  (nenhum — nos meses cobertos pelo OFX, movimento = planilha)');
} else {
  console.log(`\n→ Primeiro mês com Δ movimento: ${firstMovGap.mes} (${fmt(firstMovGap.diff)})`);
}

console.log('\n=== Sistema hoje ===');
console.log(`Saldo API: ${fmt(saldoSysHoje)}  |  Banco real: ${fmt(opts.saldoBancoHoje)}  |  Δ ${fmt(saldoSysHoje - opts.saldoBancoHoje)}`);
