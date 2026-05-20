#!/usr/bin/env node
/**
 * Relatório: planilha (aba banco) vs MySQL financeiro_lancamento.
 * Uso: node scripts/verificar-extrato-planilha-vs-banco.mjs --banco=Itaú --desde=2026-04-01
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import XLSX from 'xlsx';

import { NUMERO_PARA_BANCO } from './lib/extrato-bancos-planilha-constantes.mjs';
import {
  extrairLancamentosDaAba,
  layoutExtratoPorNomeInstituicao,
} from './lib/extrato-bancos-planilha-layouts.mjs';
import { gerarNumeroLancamento } from './lib/extrato-bancos-planilha-parse.mjs';
import {
  candidatosExtratoBancosPlanilhaXlsParaLog,
  resolveExtratoBancosPlanilhaXlsPath,
} from './lib/resolve-extrato-bancos-planilha-xls.mjs';

function parseArgs(argv) {
  const out = {
    file: null,
    banco: 'Itaú',
    desde: null,
    ate: null,
  };
  for (const a of argv) {
    if (a.startsWith('--banco=')) out.banco = a.slice(8).trim();
    else if (a.startsWith('--desde=')) out.desde = a.slice(8).trim();
    else if (a.startsWith('--ate=')) out.ate = a.slice(6).trim();
    else if (!a.startsWith('-')) out.file = a;
  }
  if (!out.file) {
    const resolved = resolveExtratoBancosPlanilhaXlsPath(null);
    if (!resolved) {
      console.error(
        'Planilha não encontrada. Tentados:\n',
        candidatosExtratoBancosPlanilhaXlsParaLog(null).map((p) => `  ${p}`).join('\n'),
      );
      process.exit(1);
    }
    out.file = resolved;
  }
  return out;
}

function fp(x) {
  const v = Math.abs(Number(x.valor) || 0);
  const nat = Number(x.valor) < 0 ? 'DEBITO' : 'CREDITO';
  return `${x.data}|${x.desc}|${v.toFixed(2)}|${nat}`;
}

function saldoFimDiaPlanilha(ws, layout, desde, ate) {
  const start = Math.max(0, (layout.primeiraLinhaExcel || 7) - 1);
  const { e } = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const porDia = new Map();
  for (let r = start; r <= e.r; r += 1) {
    const cell = (c) => ws[XLSX.utils.encode_cell({ r, c })]?.v;
    const raw = cell(3);
    let dataIso = null;
    if (raw instanceof Date) dataIso = raw.toISOString().slice(0, 10);
    else if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw)) dataIso = raw.slice(0, 10);
    if (!dataIso) continue;
    if (desde && dataIso < desde) continue;
    if (ate && dataIso > ate) continue;
    const saldo = Number(cell(8));
    if (!Number.isNaN(saldo)) porDia.set(dataIso, saldo);
  }
  return porDia;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(opts.file)) {
    console.error(`Ficheiro não encontrado: ${opts.file}`);
    process.exit(1);
  }

  const numeroBanco = Object.entries(NUMERO_PARA_BANCO).find(([, n]) => n === opts.banco)?.[0];
  if (!numeroBanco) {
    console.error(`Banco desconhecido: ${opts.banco}`);
    process.exit(1);
  }

  const wb = XLSX.readFile(opts.file, { cellDates: true, cellNF: false });
  const ws = wb.Sheets[opts.banco];
  if (!ws) {
    console.error(`Aba não encontrada: ${opts.banco}`);
    process.exit(1);
  }

  const layout = layoutExtratoPorNomeInstituicao(opts.banco);
  let plan = extrairLancamentosDaAba(ws, layout, opts.banco);
  if (opts.desde) plan = plan.filter((r) => r.dataIso >= opts.desde);
  if (opts.ate) plan = plan.filter((r) => r.dataIso <= opts.ate);

  const planRows = plan.map((r) => {
    const v = Number(r.valor) || 0;
    return {
      data: r.dataIso,
      desc: String(r.descricao || '').trim(),
      valor: v,
      letra: r.letra,
      linha: r.linhaExcel,
      nl: gerarNumeroLancamento(r),
    };
  });

  const where = [`numero_banco=${numeroBanco}`];
  if (opts.desde) where.push(`data_lancamento>='${opts.desde}'`);
  if (opts.ate) where.push(`data_lancamento<='${opts.ate}'`);

  const raw = execSync(
    `docker exec vilareal-db mysql -u root -proot vilareal --default-character-set=utf8mb4 -N -e "SELECT data_lancamento, origem, descricao, valor, natureza, numero_lancamento FROM financeiro_lancamento WHERE ${where.join(' AND ')} ORDER BY data_lancamento, id"`,
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );

  const db = raw
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [data, origem, desc, valor, nat, nl] = line.split('\t');
      const v = Number(valor);
      const signed = nat === 'DEBITO' ? -v : v;
      return {
        data: String(data).slice(0, 10),
        origem,
        desc: desc.trim(),
        valor: signed,
        nat,
        nl,
      };
    });

  const saldoPlan = saldoFimDiaPlanilha(ws, layout, opts.desde, opts.ate);

  const planM = new Map();
  for (const p of planRows) planM.set(fp(p), (planM.get(fp(p)) || 0) + 1);

  const dbM = new Map();
  for (const d of db) dbM.set(fp(d), (dbM.get(fp(d)) || 0) + 1);

  const origens = new Map();
  for (const d of db) origens.set(d.origem, (origens.get(d.origem) || 0) + 1);

  const days = [...new Set([...planRows.map((p) => p.data), ...db.map((d) => d.data)])].sort();
  const countPlan = new Map();
  const countDb = new Map();
  const movPlan = new Map();
  const movDb = new Map();
  for (const p of planRows) {
    countPlan.set(p.data, (countPlan.get(p.data) || 0) + 1);
    movPlan.set(p.data, (movPlan.get(p.data) || 0) + p.valor);
  }
  for (const d of db) {
    countDb.set(d.data, (countDb.get(d.data) || 0) + 1);
    movDb.set(d.data, (movDb.get(d.data) || 0) + d.valor);
  }

  let acumApi = Number(
    execSync(
      `docker exec vilareal-db mysql -u root -proot vilareal -N -e "SELECT COALESCE(SUM(CASE WHEN natureza='CREDITO' THEN valor ELSE -valor END),0) FROM financeiro_lancamento WHERE numero_banco=${numeroBanco} AND data_lancamento<'${opts.desde || '1900-01-01'}'"`,
      { encoding: 'utf8' },
    ).trim(),
  );

  const problemas = [];
  let okDias = 0;

  console.log(`\n=== Relatório planilha vs banco — ${opts.banco} ===`);
  console.log(`Período: ${opts.desde || 'início'} a ${opts.ate || 'fim'}`);
  console.log(`Planilha: ${opts.file}\n`);

  console.log('| Data | Plan | Banco | Mov plan | Mov banco | Saldo I | Saldo API | Status |');
  console.log('|------|------|-------|----------|-----------|---------|-----------|--------|');

  for (const day of days) {
    const cp = countPlan.get(day) || 0;
    const cd = countDb.get(day) || 0;
    const mp = movPlan.get(day) || 0;
    acumApi += movDb.get(day) || 0;
    const sp = saldoPlan.get(day);
    const deltaSaldo = sp != null ? acumApi - sp : null;
    const movOk = Math.abs(mp - (movDb.get(day) || 0)) < 0.01;
    const countOk = cp === cd;
    const saldoOk = sp == null || Math.abs(deltaSaldo) < 0.02;
    let status = 'OK';
    if (!countOk || !movOk || !saldoOk) {
      status = 'DIVERGENTE';
      problemas.push({ day, cp, cd, mp, md: movDb.get(day) || 0, sp, acumApi });
    } else okDias += 1;
    console.log(
      `| ${day} | ${cp} | ${cd} | ${mp.toFixed(2)} | ${(movDb.get(day) || 0).toFixed(2)} | ${sp != null ? sp.toFixed(2) : '—'} | ${acumApi.toFixed(2)} | ${status} |`,
    );
  }

  let matchFp = 0;
  let extraDb = 0;
  let missingDb = 0;
  for (const [k, pc] of planM) {
    const dc = dbM.get(k) || 0;
    matchFp += Math.min(pc, dc);
    if (dc < pc) missingDb += pc - dc;
    if (dc > pc) extraDb += dc - pc;
  }
  for (const [k, dc] of dbM) {
    if (!planM.has(k)) extraDb += dc;
  }

  console.log('\n--- Totais ---');
  console.log(`Planilha:     ${planRows.length} lançamentos`);
  console.log(`Banco:        ${db.length} lançamentos`);
  console.log(`Origens DB:   ${[...origens.entries()].map(([o, n]) => `${o}=${n}`).join(', ') || '—'}`);
  console.log(`Pareamento:   ${matchFp}/${planRows.length} (fingerprint data+desc+valor)`);
  console.log(`Faltam banco: ${missingDb}`);
  console.log(`Extras banco: ${extraDb}`);
  console.log(`Dias OK:      ${okDias}/${days.length}`);

  const igual =
    planRows.length === db.length &&
    missingDb === 0 &&
    extraDb === 0 &&
    problemas.length === 0 &&
    (origens.size === 0 || (origens.size === 1 && origens.has('PLANILHA')));

  console.log(`\n>>> ${igual ? 'CONFERE: planilha e banco estão iguais.' : 'NÃO CONFERE: ver divergências acima.'} <<<`);

  if (problemas.length) {
    console.log('\nDias com divergência:');
    for (const p of problemas) {
      console.log(
        `  ${p.day}: plan=${p.cp} banco=${p.cd} mov ${p.mp.toFixed(2)} vs ${p.md.toFixed(2)} saldo I=${p.sp?.toFixed(2)} API=${p.acumApi.toFixed(2)}`,
      );
    }
  }

  process.exit(igual ? 0 : 1);
}

main();
