#!/usr/bin/env node
import './lib/load-vilareal-import-env.mjs';
import { detectarParesCompensacao } from '../src/data/financeiroData.js';
import { detectarSugestoesPagamentoFatura } from '../src/data/financeiroPagamentoFatura.js';
import { detectarSugestoesRecorrenciaMensalNoBanco } from '../src/data/financeiroData.js';
import { buildContaNomeParaLetra } from './lib/financeiro-api-conta-map.mjs';

const base = (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, '');
const senha = process.env.VILAREAL_IMPORT_SENHA || '123456';

const { accessToken } = await fetch(`${base}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ login: 'itamar', senha }),
}).then((r) => r.json());
const h = { Authorization: `Bearer ${accessToken}` };

const [contas, bancos, cartoes] = await Promise.all([
  fetch(`${base}/api/financeiro/contas`, { headers: h }).then((r) => r.json()),
  fetch(`${base}/api/financeiro/lancamentos`, { headers: h }).then((r) => r.json()),
  fetch(`${base}/api/financeiro/cartoes/lancamentos`, { headers: h }).then((r) => r.json()),
]);

const contaToLetra = buildContaNomeParaLetra(contas);

function toBr(iso) {
  const s = String(iso ?? '').slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
}

function mapBanco(l) {
  const sinal = String(l.natureza ?? '').toUpperCase() === 'DEBITO' ? -1 : 1;
  return {
    apiId: l.id,
    numero: l.numeroLancamento,
    data: toBr(l.dataLancamento),
    valor: Number(l.valor) * sinal,
    descricao: l.descricao,
    letra: contaToLetra[l.contaContabilNome] || '?',
    codCliente: l.clienteCodigoExibicao || l.clienteId || '',
    proc: l.processoNumeroInternoExibicao || l.processoId || '',
    origemImportacao: l.origem,
    _financeiroMeta: { clienteId: l.clienteId, processoId: l.processoId },
  };
}

function mapCartao(l) {
  return {
    apiId: l.id,
    numero: l.numeroLancamento,
    data: toBr(l.dataLancamento),
    valor: Number(l.valor),
    descricao: l.descricao,
    letra: contaToLetra[l.contaContabilNome] || '?',
  };
}

const extratosPorBanco = {};
for (const l of bancos || []) {
  const n = String(l.bancoNome ?? '').trim() || 'API';
  if (!extratosPorBanco[n]) extratosPorBanco[n] = [];
  extratosPorBanco[n].push(mapBanco(l));
}

const extratosPorCartao = {};
for (const l of cartoes || []) {
  const n = String(l.cartaoNome ?? '').trim();
  if (!extratosPorCartao[n]) extratosPorCartao[n] = [];
  extratosPorCartao[n].push(mapCartao(l));
}

let st = { total: 0, N: 0, E: 0, A: 0, Acli: 0, Aproc: 0, origem: {} };
for (const l of bancos || []) {
  st.total++;
  const letra = contaToLetra[l.contaContabilNome];
  if (letra === 'N' || l.contaContabilNome === 'Conta Não Identificados') st.N++;
  if (letra === 'E') st.E++;
  if (letra === 'A') {
    st.A++;
    if (l.clienteId) st.Acli++;
    if (l.processoId) st.Aproc++;
  }
  const o = l.origem || 'MANUAL';
  st.origem[o] = (st.origem[o] || 0) + 1;
}

console.log('\n=== API — classificação importada ===');
console.log(`Lançamentos banco: ${st.total}`);
console.log(`  N (não ident.): ${st.N} (${((st.N / st.total) * 100).toFixed(1)}%)`);
console.log(`  E (compens.): ${st.E} (${((st.E / st.total) * 100).toFixed(1)}%)`);
console.log(`  A (escritório): ${st.A}; com clienteId ${st.Acli}; com processoId ${st.Aproc}`);
console.log('  Origem:', st.origem);

const paresComp = detectarParesCompensacao(extratosPorBanco, { incluirMesmoBanco: true });
const paresInter = paresComp.filter((p) => !p.mesmoBanco).length;
const paresMesmo = paresComp.filter((p) => p.mesmoBanco).length;
const sugFatura = detectarSugestoesPagamentoFatura(extratosPorBanco, extratosPorCartao);

let recTotal = 0;
for (const nome of ['Itaú', 'CORA', 'Sicoob']) {
  const g = detectarSugestoesRecorrenciaMensalNoBanco(extratosPorBanco[nome] ?? []);
  const cand = g.reduce((s, x) => s + x.candidatos.length, 0);
  recTotal += cand;
  console.log(`Recorrência mensal (${nome}): ${g.length} grupos, ${cand} candidatos`);
}

console.log(`\nAutomações detectáveis HOJE (sem alterar dados):`);
console.log(`  Pares compensação: ${paresComp.length} (interbancários ${paresInter}, mesmo banco ${paresMesmo})`);
console.log(`  Sugestões pagamento fatura: ${sugFatura.length}`);
console.log(`  Recorrência (copiar A+cliente): ${recTotal} candidatos`);

let eSemEloUi = 0;
for (const list of Object.values(extratosPorBanco)) {
  for (const t of list) {
    if (t.letra !== 'E') continue;
    const proc = String(t.proc ?? '').trim();
    if (!/^\d{4}$/.test(proc)) eSemEloUi++;
  }
}
console.log(
  `  E sem Elo 0001 na UI: ${eSemEloUi} (col. M da planilha não foi importada; use «Parear compensações» para sugerir pares)`,
);
