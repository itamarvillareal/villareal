#!/usr/bin/env node
/**
 * Simula importação OFX em modo mesclar (planilha como base + N arquivos OFX).
 * Uso:
 *   node scripts/simular-import-ofx.mjs --banco=Itaú --desde=2026-04-20 arquivo1.ofx arquivo2.ofx
 */

import fs from 'node:fs';
import XLSX from 'xlsx';

import { requireExtratoBancosPlanilhaXlsPath } from './lib/resolve-extrato-bancos-planilha-xls.mjs';
import { extrairLancamentosDaAba, layoutExtratoPorNomeInstituicao } from './lib/extrato-bancos-planilha-layouts.mjs';
import {
  analisarLancamentosNovosDedupe,
  dataLancamentoParaIso,
  parseOfxToExtrato,
} from '../src/utils/ofx.js';

function parseArgs(argv) {
  const out = { banco: 'Itaú', desde: '2026-04-20', ofxFiles: [] };
  for (const a of argv) {
    if (a.startsWith('--banco=')) out.banco = a.slice(8).trim();
    else if (a.startsWith('--desde=')) out.desde = a.slice(8).trim();
    else if (!a.startsWith('-')) out.ofxFiles.push(a);
  }
  return out;
}

function countByDay(rows) {
  const m = new Map();
  for (const r of rows) {
    const d = dataLancamentoParaIso(r.data);
    m.set(d, (m.get(d) || 0) + 1);
  }
  return m;
}

function carregarPlanilha(banco, desde) {
  const wb = XLSX.readFile(requireExtratoBancosPlanilhaXlsPath(), { cellDates: true });
  return extrairLancamentosDaAba(wb.Sheets[banco], layoutExtratoPorNomeInstituicao(banco), banco)
    .filter((r) => r.dataIso >= desde)
    .map((r) => {
      const [y, m, d] = r.dataIso.split('-');
      return {
        numero: `PL-${r.linhaExcel}`,
        data: `${d}/${m}/${y}`,
        valor: Number(r.valor) || 0,
        descricao: String(r.descricao || '').trim(),
        origemImportacao: 'PLANILHA',
      };
    });
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.ofxFiles.length) {
    console.error(
      'Uso: node scripts/simular-import-ofx.mjs [--banco=Itaú] [--desde=YYYY-MM-DD] ficheiro1.ofx [ficheiro2.ofx ...]',
    );
    process.exit(1);
  }

  const plan = carregarPlanilha(opts.banco, opts.desde);
  let banco = [...plan];
  const planByDay = countByDay(plan);

  console.log(`\n=== Simulação importação OFX — ${opts.banco} ===`);
  console.log(`Planilha: ${requireExtratoBancosPlanilhaXlsPath()}`);
  console.log(`Período planilha: >= ${opts.desde} → ${plan.length} lançamentos\n`);

  for (const file of opts.ofxFiles) {
    if (!fs.existsSync(file)) {
      console.error('Ficheiro não encontrado:', file);
      process.exit(1);
    }
    const ofx = parseOfxToExtrato(fs.readFileSync(file, 'utf8'), { nomeBanco: opts.banco });
    const analise = analisarLancamentosNovosDedupe(banco, ofx);
    banco = [...banco, ...analise.novos.map((r) => ({ ...r, origemImportacao: 'OFX' }))];
    console.log(`--- ${file.split('/').pop()} ---`);
    console.log(`  OFX: ${ofx.length} | ignorados: ${analise.ignorados} | novos: ${analise.novos.length} | total banco: ${banco.length}`);
    if (analise.novos.length > 0 && analise.novos.length <= 5) {
      for (const n of analise.novos) {
        console.log(`    + ${n.data} ${n.valor} ${String(n.descricao).slice(0, 55)}`);
      }
    }
  }

  const bancoByDay = countByDay(banco);
  let diverg = 0;
  console.log('\n| Data | Plan | Banco sim | Diff |');
  console.log('|------|------|-----------|------|');
  for (const d of [...planByDay.keys()].sort()) {
    const p = planByDay.get(d) || 0;
    const b = bancoByDay.get(d) || 0;
    const diff = b - p;
    if (diff !== 0) diverg += 1;
    if (diff !== 0 || d >= opts.desde.slice(0, 7) + '-05-06') {
      console.log(`| ${d} | ${p} | ${b} | ${diff === 0 ? 'OK' : diff > 0 ? `+${diff}` : diff} |`);
    }
  }

  const ok = diverg === 0 && banco.length === plan.length;
  console.log(`\n>>> ${ok ? 'CONFERE com a planilha.' : `DIVERGÊNCIA: ${diverg} dia(s); total plan ${plan.length} vs banco ${banco.length}`} <<<`);
  process.exit(ok ? 0 : 1);
}

main();
