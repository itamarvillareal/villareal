#!/usr/bin/env node
/**
 * Backfill col. M (grupo compensação) da planilha → API (sem reimportar extratos).
 */

import './lib/load-vilareal-import-env.mjs';
import XLSX from 'xlsx';
import { BANCOS_IMPORT_PLANILHA } from './lib/extrato-bancos-planilha-constantes.mjs';
import {
  extrairLancamentosDaAba,
  layoutExtratoPorNomeInstituicao,
} from './lib/extrato-bancos-planilha-layouts.mjs';

const FILE = process.argv[2] || '/Users/itamar/Downloads/Extratos Bancos - Itamar.xls';
const base = (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, '');
const senha = process.env.VILAREAL_IMPORT_SENHA || '123456';
const CHUNK = Number(process.env.VILAREAL_IMPORT_CHUNK || 400);

const loginRes = await fetch(`${base}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ login: 'itamar', senha }),
});
if (!loginRes.ok) throw new Error(`login ${loginRes.status}`);
const { accessToken } = await loginRes.json();
const h = {
  Authorization: `Bearer ${accessToken}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

const wb = XLSX.readFile(FILE, { cellDates: true });
/** @type {{ numeroLancamento: string, grupoCompensacao: string }[]} */
const itens = [];

for (const banco of BANCOS_IMPORT_PLANILHA) {
  const ws = wb.Sheets[banco];
  if (!ws) continue;
  const linhas = extrairLancamentosDaAba(ws, layoutExtratoPorNomeInstituicao(banco), banco);
  for (const row of linhas) {
    if (row.letra !== 'E' || !row.grupoCompensacao) continue;
    itens.push({
      numeroLancamento: row.numeroLancamento,
      grupoCompensacao: String(row.grupoCompensacao),
    });
  }
}

console.log(`\nBackfill grupo compensação (col. M, letra E)`);
console.log(`Planilha: ${FILE}`);
console.log(`Itens a enviar: ${itens.length}\n`);

let totalAtualizados = 0;
let totalNaoEncontrados = 0;
let totalIgnorados = 0;

for (let i = 0; i < itens.length; i += CHUNK) {
  const chunk = itens.slice(i, i + CHUNK);
  const res = await fetch(`${base}/api/financeiro/lancamentos/grupos-compensacao/lote`, {
    method: 'POST',
    headers: h,
    body: JSON.stringify(chunk),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`POST lote ${res.status}: ${t.slice(0, 500)}`);
  }
  const r = await res.json();
  totalAtualizados += r.atualizados ?? 0;
  totalNaoEncontrados += r.naoEncontrados ?? 0;
  totalIgnorados += r.ignorados ?? 0;
  if ((i + CHUNK) % 4000 === 0 || i + CHUNK >= itens.length) {
    console.log(`  … ${Math.min(i + CHUNK, itens.length)}/${itens.length}`);
  }
}

console.log('\n--- Resultado ---');
console.log(`Atualizados:      ${totalAtualizados}`);
console.log(`Não encontrados:  ${totalNaoEncontrados}`);
console.log(`Ignorados:        ${totalIgnorados}`);
