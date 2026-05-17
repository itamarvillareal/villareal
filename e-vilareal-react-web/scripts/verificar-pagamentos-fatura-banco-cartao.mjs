#!/usr/bin/env node
/** Relatório: débitos banco (cartão/fatura) × pagamentos na fatura — sugestões e vínculos na API. */

import './lib/load-vilareal-import-env.mjs';
import { CONTA_TO_LETRA } from '../src/data/financeiroData.js';
import {
  detectarSugestoesPagamentoFatura,
  lancamentoBancoElegivelPagamentoFatura,
  lancamentoCartaoElegivelPagamentoFatura,
} from '../src/data/financeiroPagamentoFatura.js';

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

const invConta = Object.fromEntries(Object.entries(CONTA_TO_LETRA).map(([l, n]) => [n, l]));

function mapBanco(l) {
  const sinal = String(l.natureza ?? '').toUpperCase() === 'DEBITO' ? -1 : 1;
  return {
    apiId: l.id,
    numero: String(l.numeroLancamento ?? ''),
    data: br(l.dataLancamento),
    valor: Number(l.valor) * sinal,
    descricao: String(l.descricao ?? ''),
    letra: invConta[l.contaContabilNome] || 'N',
    nomeBanco: l.bancoNome,
  };
}

function mapCartao(l) {
  return {
    apiId: l.id,
    numero: String(l.numeroLancamento ?? ''),
    data: br(l.dataLancamento),
    valor: Number(l.valor),
    descricao: String(l.descricao ?? ''),
    nomeBanco: l.cartaoNome,
  };
}

function br(iso) {
  const s = String(iso ?? '').slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return s;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

const [resBanco, resCartao, resVinc] = await Promise.all([
  fetch(`${base}/api/financeiro/lancamentos`, { headers: h }),
  fetch(`${base}/api/financeiro/cartoes/lancamentos`, { headers: h }),
  fetch(`${base}/api/financeiro/pagamentos-fatura/vinculos`, { headers: h }),
]);

if (!resBanco.ok) throw new Error(`GET bancos ${resBanco.status}`);
if (!resCartao.ok) throw new Error(`GET cartões ${resCartao.status}`);

const bancos = await resBanco.json();
const cartoes = await resCartao.json();
let vinculos = [];
if (resVinc.ok) vinculos = await resVinc.json();
else console.warn(`(vínculos: GET ${resVinc.status} — reinicie API com migration V42)\n`);

const extratosPorBanco = {};
for (const l of bancos || []) {
  const nome = String(l.bancoNome ?? '').trim() || 'API';
  if (!extratosPorBanco[nome]) extratosPorBanco[nome] = [];
  extratosPorBanco[nome].push(mapBanco(l));
}

const extratosPorCartao = {};
for (const l of cartoes || []) {
  const nome = String(l.cartaoNome ?? '').trim() || 'Cartão';
  if (!extratosPorCartao[nome]) extratosPorCartao[nome] = [];
  extratosPorCartao[nome].push(mapCartao(l));
}

let poolB = 0;
let poolC = 0;
for (const list of Object.values(extratosPorBanco)) {
  poolB += list.filter(lancamentoBancoElegivelPagamentoFatura).length;
}
for (const list of Object.values(extratosPorCartao)) {
  poolC += list.filter(lancamentoCartaoElegivelPagamentoFatura).length;
}

const sugestoes = detectarSugestoesPagamentoFatura(extratosPorBanco, extratosPorCartao);

console.log('\n--- Pagamento fatura (banco ↔ cartão) ---');
console.log(`Elegíveis banco (débito): ${poolB}`);
console.log(`Elegíveis cartão (pagamento fatura): ${poolC}`);
console.log(`Sugestões automáticas: ${sugestoes.length}`);
console.log(`Vínculos gravados na API: ${Array.isArray(vinculos) ? vinculos.length : 0}`);

if (sugestoes.length > 0) {
  console.log('\nAmostra sugestões:');
  for (const s of sugestoes.slice(0, 5)) {
    console.log(
      `  [${s.confianca}] ${s.banco.nome} ${s.banco.data} ${s.banco.valor} ↔ ${s.cartao.nome} ${s.cartao.data} ${s.cartao.valor} (Δ${s.diasDistancia}d)`,
    );
  }
}

const known = new Set([
  'Itaú', 'Bradesco', 'BB', 'Sicoob', 'CEF', 'Itaú Poupança', 'LANÇ MANUAIS', 'Poupança Bradesco',
  'Mercado Pago', 'CEF Poupança', 'Nubank', 'PicPay', 'PicPay Rachel', 'LANÇ EM DINHEIRO',
  'LANÇ MANUAIS (2)', 'BTG', 'ITI', 'Itaú Empresas', 'BTG Banking', 'BTG (2)', 'CORA',
  'BTG JA', 'BTG RACHEL', 'Sicoob VRV',
]);
const bad = (bancos || []).filter((l) => !known.has(String(l.bancoNome || '').trim()));
console.log(`\nLançamentos com bancoNome fora da lista: ${bad.length}`);
if (bad.length > 0) {
  for (const l of bad.slice(0, 5)) {
    console.log(`  id=${l.id} bancoNome=${JSON.stringify(l.bancoNome)} numeroBanco=${l.numeroBanco}`);
  }
}
