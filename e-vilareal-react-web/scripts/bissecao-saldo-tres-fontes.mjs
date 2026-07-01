#!/usr/bin/env node
/**
 * Bissecção por eliminação: planilha col I × DB API × OFX (saldo reconstruído).
 */
import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';

import './lib/load-vilareal-import-env.mjs';
import { parseOfxToExtrato, dataLancamentoParaIso } from '../src/utils/ofx.js';
import { extrairMetadadosOfx } from '../src/components/financeiro/extrato/extratoRepararDiagnosticoCore.js';

const PLANILHA = '/Users/itamar/Dropbox/sistema/Extratos Bancos - Itamar.xls';
const ITAU = '9664007474';
const BASE = 'http://localhost:8080';
const BANK_HOJE = -1976.73;

const OFX_DIRS = ['/Users/itamar/Downloads', '/Users/itamar/Dropbox/pasta sem título 2'];

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

function fmt(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function listarOfxItau() {
  const found = new Set();
  for (const dir of OFX_DIRS) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.toLowerCase().endsWith('.ofx')) continue;
      const fp = path.join(dir, f);
      try {
        if (fs.readFileSync(fp, 'utf8').includes(ITAU)) found.add(fp);
      } catch {
        /* ignore */
      }
    }
  }
  return [...found];
}

function carregarPlanilha() {
  const wb = XLSX.readFile(PLANILHA, { cellDates: true, cellNF: false });
  const ws = wb.Sheets['Itaú'];
  const { e } = XLSX.utils.decode_range(ws['!ref']);
  /** @type {Map<string, number>} saldo col I no fim de cada dia */
  const saldoFimDia = new Map();
  /** @type {Map<string, number>} movimento por dia */
  const movDia = new Map();

  for (let r = 6; r <= e.r; r += 1) {
    const d = parseDataIso(ws[XLSX.utils.encode_cell({ r, c: 3 })]?.v);
    if (!d) continue;
    const val = parseSaldo(ws[XLSX.utils.encode_cell({ r, c: 7 })]) ?? 0;
    movDia.set(d, (movDia.get(d) ?? 0) + val);
    const saldoI = parseSaldo(ws[XLSX.utils.encode_cell({ r, c: 8 })]);
    if (saldoI != null) saldoFimDia.set(d, saldoI);
  }
  return { saldoFimDia, movDia, e };
}

function carregarOfxMesclado() {
  const files = listarOfxItau();
  /** @type {Array<{iso: string, valor: number, fitid: string, file: string}>} */
  const txs = [];
  for (const fp of files) {
    const rows = parseOfxToExtrato(fs.readFileSync(fp, 'utf8'));
    for (const r of rows) {
      const iso = dataLancamentoParaIso(r.data);
      if (!iso) continue;
      txs.push({
        iso,
        valor: Number(r.valor) || 0,
        fitid: String(r.numero ?? r.fitid ?? ''),
        file: path.basename(fp),
      });
    }
  }
  // dedupe por FITID (mesmo lançamento em vários exports)
  const byFit = new Map();
  for (const t of txs) {
    const k = t.fitid || `${t.iso}|${t.valor}|${t.file}`;
    if (!byFit.has(k)) byFit.set(k, t);
  }
  return { txs: [...byFit.values()], files };
}

function saldoPlanilhaEm(saldoFimDia, iso) {
  let last = null;
  for (const [d, s] of [...saldoFimDia.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (d <= iso) last = s;
    else break;
  }
  return last;
}

function construirSaldoOfx(txs, aberturaIso, aberturaValor) {
  const movDia = new Map();
  for (const t of txs) {
    if (t.iso <= aberturaIso) continue;
    movDia.set(t.iso, (movDia.get(t.iso) ?? 0) + t.valor);
  }
  const dias = [...movDia.keys()].sort();
  const saldoFimDia = new Map();
  saldoFimDia.set(aberturaIso, aberturaValor);
  let acum = aberturaValor;
  for (const d of dias) {
    acum += movDia.get(d) ?? 0;
    saldoFimDia.set(d, acum);
  }
  return { saldoFimDia, movDia };
}

async function saldoDbEm(iso, headers) {
  const j = await (
    await fetch(`${BASE}/api/financeiro/lancamentos/saldo-banco?numeroBanco=1&data=${iso}`, { headers })
  ).json();
  return Number(j.saldo);
}

function compararTres(data, plan, db, ofx) {
  const p = round2(plan);
  const d = round2(db);
  const o = ofx == null ? null : round2(ofx);
  const iguais = o != null ? Math.abs(p - d) < 0.01 && Math.abs(p - o) < 0.01 : Math.abs(p - d) < 0.01;
  return { data, plan: p, db: d, ofx: o, iguais };
}

async function main() {
  const { saldoFimDia: planSaldo, movDia: planMov } = carregarPlanilha();
  const { txs: ofxTxs, files: ofxFiles } = carregarOfxMesclado();

  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'itamar', senha: process.env.VILAREAL_IMPORT_SENHA }),
  });
  const { accessToken } = await loginRes.json();
  const headers = { Authorization: `Bearer ${accessToken}` };

  // Âncora: saldo planilha em 31/12/2015 (véspera da série moderna) ou primeiro dia com dado
  const vespera2015 = '2015-12-31';
  const abertura2016 = saldoPlanilhaEm(planSaldo, vespera2015) ?? 0;

  console.log('=== Bissecção saldo: planilha × DB × OFX ===\n');
  console.log(`OFX Itaú: ${ofxFiles.length} arquivo(s), ${ofxTxs.length} lanç. únicos`);
  console.log(`Planilha col I véspera 31/12/2015: ${fmt(abertura2016)}`);
  console.log(`Banco hoje (confirmado): ${fmt(BANK_HOJE)}\n`);

  // OFX só cobre a partir de ~2026 nos arquivos Itaú; para 2016–2025 usamos planilha como referência OFX indisponível
  const ofxMin = ofxTxs.map((t) => t.iso).sort()[0] ?? '9999-99-99';

  // DB e planilha: bissecção ano a ano desde 2016
  console.log('=== Por ano (31/12) — planilha vs DB ===');
  let primeiroAnoDiff = null;
  for (let ano = 2016; ano <= 2026; ano += 1) {
    const iso = ano === 2026 ? '2026-06-30' : `${ano}-12-31`;
    const plan = saldoPlanilhaEm(planSaldo, iso);
    const db = await saldoDbEm(iso, headers);
    const diff = round2((plan ?? 0) - db);
    const ok = Math.abs(diff) < 0.01;
    console.log(
      `${iso}  plan ${fmt(plan)}  db ${fmt(db)}  Δ ${fmt(diff)}  ${ok ? '✓' : '✗ DIFERENTE'}`,
    );
    if (!ok && !primeiroAnoDiff) primeiroAnoDiff = { iso, plan, db, diff };
  }

  // Checkpoint pedido: 01/01/2026
  console.log('\n=== CHECKPOINT 01/01/2026 ===');
  const isoCheck = '2026-01-01';
  const plan0101 = saldoPlanilhaEm(planSaldo, isoCheck);
  const db0101 = await saldoDbEm(isoCheck, headers);

  // OFX em 01/01/2026: reconstruir desde 31/12/2025 planilha (=0) + mov OFX só se houver antes de 2026-01-02
  const plan3112 = saldoPlanilhaEm(planSaldo, '2025-12-31');
  const ofxDesde3112 = construirSaldoOfx(ofxTxs, '2025-12-31', plan3112 ?? 0);
  const ofx0101 = ofxDesde3112.saldoFimDia.get(isoCheck) ?? plan3112;

  const c = compararTres(isoCheck, plan0101, db0101, ofx0101);
  console.log(`Planilha col I: ${fmt(c.plan)}`);
  console.log(`DB API:         ${fmt(c.db)}`);
  console.log(`OFX reconstr.:  ${fmt(c.ofx)}  (OFX txs desde ${ofxMin})`);
  console.log(`Plan = DB?      ${Math.abs(c.plan - c.db) < 0.01 ? 'SIM ✓' : 'NÃO ✗'}`);

  const planEqDb = Math.abs(c.plan - c.db) < 0.01;
  if (planEqDb) {
    console.log('\n→ 01/01/2026: planilha = DB. Erro está PARA FRENTE (2026).');
  } else {
    console.log('\n→ 01/01/2026: planilha ≠ DB. Erro está PARA TRÁS (≤ 2025).');
  }

  // Bissecção diária 2026 se plan=db em 01/01
  if (planEqDb) {
    console.log('\n=== 2026 dia a dia (plan vs DB vs OFX) ===');
    const abertura = plan0101 ?? 0;
    const ofx2026 = construirSaldoOfx(
      ofxTxs.filter((t) => t.iso >= '2026-01-01'),
      '2026-01-01',
      abertura,
    );
    let primeiroDiaDiff = null;
    const dias2026 = [
      ...new Set([
        ...[...planSaldo.keys()].filter((d) => d.startsWith('2026')),
        ...[...ofx2026.saldoFimDia.keys()].filter((d) => d.startsWith('2026')),
      ]),
    ].sort();

    for (const d of dias2026) {
      const plan = saldoPlanilhaEm(planSaldo, d);
      if (plan == null && !planMov.has(d)) continue;
      const db = await saldoDbEm(d, headers);
      const ofx = ofx2026.saldoFimDia.get(d) ?? saldoPlanilhaEm(planSaldo, d);
      const dp = round2((plan ?? 0) - db);
      const dpo = round2((plan ?? 0) - (ofx ?? 0));
      const ok = Math.abs(dp) < 0.01 && Math.abs(dpo) < 0.01;
      if (!ok) {
        if (!primeiroDiaDiff) primeiroDiaDiff = { d, plan, db, ofx, dp, dpo };
        console.log(
          `${d}  plan ${fmt(plan)}  db ${fmt(db)}  ofx ${fmt(ofx)}  Δplan-db ${fmt(dp)}  Δplan-ofx ${fmt(dpo)}`,
        );
      }
    }
    if (!primeiroDiaDiff) {
      console.log('Todos os dias com planilha em 2026: plan = db = ofx ✓');
    } else {
      console.log(`\n→ Primeiro dia com divergência em 2026: ${primeiroDiaDiff.d}`);
    }

    const dbHoje = await saldoDbEm('2026-06-30', headers);
    console.log('\n=== Saldo final 30/06/2026 ===');
    console.log(`Planilha (últ. 19/05): ${fmt(saldoPlanilhaEm(planSaldo, '2026-05-19'))}`);
    console.log(`DB:                    ${fmt(dbHoje)}`);
    console.log(`OFX acum. 2026:        ${fmt(ofx2026.saldoFimDia.get('2026-06-30'))}`);
    console.log(`Banco real hoje:       ${fmt(BANK_HOJE)}`);
    console.log(`Δ DB − banco:          ${fmt(dbHoje - BANK_HOJE)}`);
  } else {
    // Bissecção mensal 2014–2025 plan vs db
    console.log('\n=== Mensal planilha vs DB (primeiras divergências) ===');
    let count = 0;
    for (let ano = 2014; ano <= 2025; ano += 1) {
      for (let mes = 1; mes <= 12; mes += 1) {
        const ultimo = new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);
        const plan = saldoPlanilhaEm(planSaldo, ultimo);
        const db = await saldoDbEm(ultimo, headers);
        const diff = round2((plan ?? 0) - db);
        if (Math.abs(diff) >= 0.01) {
          console.log(`${ultimo}  plan ${fmt(plan)}  db ${fmt(db)}  Δ ${fmt(diff)}`);
          count += 1;
          if (count >= 15) break;
        }
      }
      if (count >= 15) break;
    }
    if (count === 0) console.log('Nenhuma divergência mensal plan vs db em 2014–2025 ✓');
  }

  // Onde plan=db mas ambos ≠ banco
  const db3006 = await saldoDbEm('2026-06-30', headers);
  console.log('\n=== Planilha=DB vs banco real ===');
  console.log(`DB 30/06/2026:     ${fmt(db3006)}`);
  console.log(`Banco real:        ${fmt(BANK_HOJE)}`);
  console.log(`Gap:               ${fmt(db3006 - BANK_HOJE)}`);
  console.log(`DB 01/01/2026:     ${fmt(db0101)}`);
  console.log(`Banco impl. 31/12/2025: ${fmt(BANK_HOJE - 2963.19)}`);
  console.log(`Gap em 01/01/2026: ${fmt(db0101 - (BANK_HOJE - 2963.19))}`);
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
