#!/usr/bin/env node
/** Compara contagens planilha × API (bancos e cartões). */

import './lib/load-vilareal-import-env.mjs';
import XLSX from 'xlsx';
import {
  BANCOS_IMPORT_PLANILHA,
  CARTOES_IMPORT_PLANILHA,
  NUMERO_PARA_BANCO,
  NUMERO_PARA_CARTAO,
} from './lib/extrato-bancos-planilha-constantes.mjs';
import {
  extrairLancamentosDaAba,
  layoutExtratoPorNomeInstituicao,
} from './lib/extrato-bancos-planilha-layouts.mjs';

import { requireExtratoBancosPlanilhaXlsPath } from './lib/resolve-extrato-bancos-planilha-xls.mjs';

const FILE = requireExtratoBancosPlanilhaXlsPath(process.argv[2]);
const base = (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, '');
const senha = process.env.VILAREAL_IMPORT_SENHA || '123456';

const res = await fetch(`${base}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ login: 'itamar', senha }),
});
if (!res.ok) throw new Error(`login ${res.status}`);
const { accessToken } = await res.json();
const h = { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' };

const [resBanco, resCartao] = await Promise.all([
  fetch(`${base}/api/financeiro/lancamentos`, { headers: h }),
  fetch(`${base}/api/financeiro/cartoes/lancamentos`, { headers: h }),
]);
if (!resBanco.ok) throw new Error(`GET lancamentos ${resBanco.status}`);
const lancsBanco = await resBanco.json();
let lancsCartao = [];
if (resCartao.ok) {
  const body = await resCartao.json();
  lancsCartao = Array.isArray(body) ? body : [];
} else {
  console.warn(`(cartões: GET ${resCartao.status} — reinicie API com migration V41)\n`);
}

const wb = XLSX.readFile(FILE, { cellDates: true });
const countApiBanco = {};
const countApiCartao = {};
for (const l of lancsBanco || []) {
  const n = String(l.bancoNome || '').trim();
  if (n) countApiBanco[n] = (countApiBanco[n] || 0) + 1;
}
for (const l of lancsCartao || []) {
  const n = String(l.cartaoNome || '').trim();
  if (n) countApiCartao[n] = (countApiCartao[n] || 0) + 1;
}

console.log('\n--- Bancos ---');
let okB = 0;
for (const nome of BANCOS_IMPORT_PLANILHA) {
  const plan = extrairLancamentosDaAba(
    wb.Sheets[nome],
    layoutExtratoPorNomeInstituicao(nome),
    nome,
  ).length;
  const api = countApiBanco[nome] || 0;
  const ok = plan === api;
  if (ok) okB += 1;
  console.log(`${ok ? 'OK' : 'DIFF'} ${nome.padEnd(22)} plan=${String(plan).padStart(6)} api=${String(api).padStart(6)}`);
}
console.log(`Bancos OK: ${okB}/${BANCOS_IMPORT_PLANILHA.length}`);

console.log('\n--- Cartões ---');
let okC = 0;
for (const nome of CARTOES_IMPORT_PLANILHA) {
  const plan = extrairLancamentosDaAba(
    wb.Sheets[nome],
    layoutExtratoPorNomeInstituicao(nome),
    nome,
  ).length;
  const api = countApiCartao[nome] || 0;
  const ok = plan === api;
  if (ok) okC += 1;
  console.log(`${ok ? 'OK' : 'DIFF'} ${nome.padEnd(22)} plan=${String(plan).padStart(6)} api=${String(api).padStart(6)}`);
}
console.log(`Cartões OK: ${okC}/${CARTOES_IMPORT_PLANILHA.length}`);
