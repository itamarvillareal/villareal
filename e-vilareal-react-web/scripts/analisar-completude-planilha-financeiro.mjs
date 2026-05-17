#!/usr/bin/env node
/**
 * Analisa completude do trabalho manual na planilha (letra, cliente/proc, compensação)
 * por banco e por mês — base para sugerir automações.
 */

import XLSX from 'xlsx';
import {
  BANCOS_IMPORT_PLANILHA,
  CARTOES_IMPORT_PLANILHA,
  LETRA_PARA_CONTA,
} from './lib/extrato-bancos-planilha-constantes.mjs';
import {
  extrairLancamentosDaAba,
  layoutExtratoPorNomeInstituicao,
} from './lib/extrato-bancos-planilha-layouts.mjs';

const FILE = process.argv[2] || '/Users/itamar/Downloads/Extratos Bancos - Itamar.xls';

function mesAno(dataIso) {
  if (!dataIso) return null;
  const s = String(dataIso).slice(0, 7);
  return /^\d{4}-\d{2}$/.test(s) ? s : null;
}

function analisarLinhas(linhas) {
  let comData = 0;
  let comLetra = 0;
  let letraN = 0;
  let letraE = 0;
  let letraA = 0;
  let letraAComCod = 0;
  let letraAComProc = 0;
  let eloNumerico = 0; // E com proc 0001+
  let orfaoE = 0; // E sem proc ou ?n
  const porMes = new Map();

  for (const row of linhas) {
    const d = row.dataIso;
    if (!d) continue;
    comData += 1;
    const mes = mesAno(d);
    if (!mes) continue;
    if (!porMes.has(mes)) {
      porMes.set(mes, {
        total: 0,
        comLetra: 0,
        letraN: 0,
        letraA: 0,
        letraAComCod: 0,
        elo: 0,
      });
    }
    const pm = porMes.get(mes);
    pm.total += 1;

    const L = String(row.letra || '').trim().toUpperCase();
    if (L) {
      comLetra += 1;
      pm.comLetra += 1;
    }
    if (L === 'N' || !L) letraN += 1;
    if (L === 'N') pm.letraN += 1;
    if (L === 'E') {
      letraE += 1;
      const proc = String(row.proc || '').trim();
      if (/^\d{4}$/.test(proc)) {
        eloNumerico += 1;
        pm.elo += 1;
      } else orfaoE += 1;
    }
    if (L === 'A') {
      letraA += 1;
      pm.letraA += 1;
      const cod = String(row.codCliente || '').trim();
      const proc = String(row.proc || '').trim();
      if (cod) {
        letraAComCod += 1;
        pm.letraAComCod += 1;
      }
      if (proc) letraAComProc += 1;
    }
  }

  return {
    comData,
    comLetra,
    pctLetra: comData ? ((comLetra / comData) * 100).toFixed(1) : '0',
    letraN,
    pctN: comData ? ((letraN / comData) * 100).toFixed(1) : '0',
    letraE,
    eloNumerico,
    orfaoE,
    letraA,
    letraAComCod,
    pctACod: letraA ? ((letraAComCod / letraA) * 100).toFixed(1) : '—',
    porMes,
  };
}

const wb = XLSX.readFile(FILE, { cellDates: true });

console.log(`\nPlanilha: ${FILE}\n`);

// --- Por banco (amostra principais) ---
const bancosChave = ['Itaú', 'CORA', 'BTG', 'Sicoob', 'Mercado Pago'];
console.log('=== Bancos (completude global) ===');
for (const nome of bancosChave) {
  const ws = wb.Sheets[nome];
  if (!ws) continue;
  const linhas = extrairLancamentosDaAba(ws, layoutExtratoPorNomeInstituicao(nome), nome);
  const a = analisarLinhas(linhas);
  console.log(
    `${nome.padEnd(18)} linhas=${String(a.comData).padStart(6)} letra=${a.pctLetra}% N=${a.pctN}% E=${a.letraE} elo=${a.eloNumerico} órfE=${a.orfaoE} A=${a.letraA} A+cod=${a.pctACod}%`,
  );
}

// --- Itaú por mês (últimos 24 meses com dados) ---
const itau = extrairLancamentosDaAba(
  wb.Sheets['Itaú'],
  layoutExtratoPorNomeInstituicao('Itaú'),
  'Itaú',
);
const ai = analisarLinhas(itau);
const meses = [...ai.porMes.entries()].sort((a, b) => a[0].localeCompare(b[0]));
console.log('\n=== Itaú — por mês (classificação) ===');
console.log('mês      total  %letra  %N    A   A+cod  elo(E)');
for (const [mes, pm] of meses.slice(-36)) {
  const pctLetra = pm.total ? ((pm.comLetra / pm.total) * 100).toFixed(0) : '0';
  const pctN = pm.total ? ((pm.letraN / pm.total) * 100).toFixed(0) : '0';
  const pctACod = pm.letraA ? ((pm.letraAComCod / pm.letraA) * 100).toFixed(0) : '—';
  console.log(
    `${mes}  ${String(pm.total).padStart(5)}  ${String(pctLetra).padStart(5)}%  ${String(pctN).padStart(4)}%  ${String(pm.letraA).padStart(4)}  ${String(pctACod).padStart(4)}%  ${String(pm.elo).padStart(4)}`,
  );
}

// Meses "completos" vs "incompletos" (heurística)
let completos = 0;
let incompletos = 0;
for (const [, pm] of meses) {
  if (pm.total < 20) continue;
  const pctN = pm.letraN / pm.total;
  const pctLetra = pm.comLetra / pm.total;
  const completo = pctLetra >= 0.85 && pctN <= 0.2;
  if (completo) completos += 1;
  else incompletos += 1;
}
console.log(`\nItaú meses (≥20 lanç.): ~completos=${completos} incompletos=${incompletos}`);

// --- Todos bancos agregado ---
let tot = 0;
let totLetra = 0;
let totN = 0;
let totA = 0;
let totACod = 0;
let totE = 0;
let totElo = 0;
for (const nome of BANCOS_IMPORT_PLANILHA) {
  const ws = wb.Sheets[nome];
  if (!ws) continue;
  const linhas = extrairLancamentosDaAba(ws, layoutExtratoPorNomeInstituicao(nome), nome);
  const a = analisarLinhas(linhas);
  tot += a.comData;
  totLetra += a.comLetra;
  totN += a.letraN;
  totA += a.letraA;
  totACod += a.letraAComCod;
  totE += a.letraE;
  totElo += a.eloNumerico;
}
console.log('\n=== Todos os bancos (planilha) ===');
console.log(`Lançamentos: ${tot}`);
console.log(`Com letra: ${totLetra} (${((totLetra / tot) * 100).toFixed(1)}%)`);
console.log(`Letra N (ou vazio): ${totN} (${((totN / tot) * 100).toFixed(1)}%)`);
console.log(`Letra A: ${totA}; A com código cliente: ${totACod} (${totA ? ((totACod / totA) * 100).toFixed(1) : 0}%)`);
console.log(`Letra E: ${totE}; com Elo (proc 4 dígitos): ${totElo} (${totE ? ((totElo / totE) * 100).toFixed(1) : 0}%)`);

// Cartões
let ct = 0;
let ctLetra = 0;
for (const nome of CARTOES_IMPORT_PLANILHA) {
  const ws = wb.Sheets[nome];
  if (!ws) continue;
  const linhas = extrairLancamentosDaAba(ws, layoutExtratoPorNomeInstituicao(nome), nome);
  const a = analisarLinhas(linhas);
  ct += a.comData;
  ctLetra += a.comLetra;
}
console.log(`\nCartões: ${ct} lanç.; com letra ${ctLetra} (${ct ? ((ctLetra / ct) * 100).toFixed(1) : 0}%)`);

console.log('\nLetras → contas:', Object.keys(LETRA_PARA_CONTA).join(', '));
