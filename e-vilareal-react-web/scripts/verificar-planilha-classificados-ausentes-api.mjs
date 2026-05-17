#!/usr/bin/env node
/**
 * Lançamentos já classificados na planilha (letra ≠ N) que não existem na API
 * (por numeroLancamento PL-* gerado na importação).
 */

import './lib/load-vilareal-import-env.mjs';
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
import { buildContaNomeParaLetra } from './lib/financeiro-api-conta-map.mjs';

const FILE = process.argv[2] || '/Users/itamar/Downloads/Extratos Bancos - Itamar.xls';
const base = (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, '');
const senha = process.env.VILAREAL_IMPORT_SENHA || '123456';

function classificadoNaPlanilha(row) {
  const L = String(row.letra ?? '').trim().toUpperCase();
  if (!L || L === 'N') return false;
  if (row.letraDesconhecida) return false;
  return Boolean(LETRA_PARA_CONTA[L]);
}

const loginRes = await fetch(`${base}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ login: 'itamar', senha }),
});
if (!loginRes.ok) throw new Error(`login ${loginRes.status}`);
const { accessToken } = await loginRes.json();
const h = { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' };

const [contas, lancsBanco, lancsCartao] = await Promise.all([
  fetch(`${base}/api/financeiro/contas`, { headers: h }).then((r) => r.json()),
  fetch(`${base}/api/financeiro/lancamentos`, { headers: h }).then((r) => r.json()),
  fetch(`${base}/api/financeiro/cartoes/lancamentos`, { headers: h }).then((r) => r.json()),
]);

const contaLetra = buildContaNomeParaLetra(contas);

const numerosApiBanco = new Map();
for (const l of lancsBanco || []) {
  const b = String(l.bancoNome ?? '').trim();
  if (!numerosApiBanco.has(b)) numerosApiBanco.set(b, new Set());
  numerosApiBanco.get(b).add(String(l.numeroLancamento ?? ''));
}

const numerosApiCartao = new Map();
for (const l of lancsCartao || []) {
  const c = String(l.cartaoNome ?? '').trim();
  if (!numerosApiCartao.has(c)) numerosApiCartao.set(c, new Set());
  numerosApiCartao.get(c).add(String(l.numeroLancamento ?? ''));
}

const wb = XLSX.readFile(FILE, { cellDates: true });
let totalClass = 0;
let totalAusentes = 0;
const porBanco = [];

function verificarInstituicao(nome, tipo) {
  const ws = wb.Sheets[nome];
  if (!ws) {
    porBanco.push({ nome, tipo, erro: 'aba ausente' });
    return;
  }
  const linhas = extrairLancamentosDaAba(ws, layoutExtratoPorNomeInstituicao(nome), nome);
  const apiSet = tipo === 'cartao' ? numerosApiCartao.get(nome) : numerosApiBanco.get(nome);
  const ausentes = [];
  let classificados = 0;
  for (const row of linhas) {
    if (!classificadoNaPlanilha(row)) continue;
    classificados += 1;
    const num = String(row.numeroLancamento ?? '');
    if (!apiSet?.has(num)) {
      ausentes.push({
        linha: row.linhaExcel,
        letra: row.letra,
        data: row.dataIso,
        valor: row.valor,
        descricao: String(row.descricao ?? '').slice(0, 50),
        numeroLancamento: num,
        codigoCliente: row.codigoCliente ?? null,
      });
    }
  }
  totalClass += classificados;
  totalAusentes += ausentes.length;
  porBanco.push({
    nome,
    tipo,
    linhasPlanilha: linhas.length,
    classificados,
    ausentes: ausentes.length,
    amostra: ausentes.slice(0, 3),
  });
}

console.log(`\nPlanilha: ${FILE}`);
console.log(`API: ${base}\n`);
console.log('=== Classificados na planilha (letra ≠ N) ausentes na API ===\n');

for (const nome of BANCOS_IMPORT_PLANILHA) verificarInstituicao(nome, 'banco');
for (const nome of CARTOES_IMPORT_PLANILHA) verificarInstituicao(nome, 'cartao');

for (const b of porBanco.sort((a, b) => b.ausentes - a.ausentes)) {
  if (b.erro) {
    console.log(`${b.nome}: ${b.erro}`);
    continue;
  }
  const flag = b.ausentes === 0 ? 'OK' : 'FALTA';
  console.log(
    `${flag} ${b.nome.padEnd(22)} plan=${String(b.linhasPlanilha).padStart(6)} class=${String(b.classificados).padStart(6)} ausentes=${String(b.ausentes).padStart(5)}`,
  );
  for (const a of b.amostra || []) {
    console.log(
      `      L${a.linha} ${a.letra} ${a.data} ${a.valor} ${a.descricao} [${a.numeroLancamento}]`,
    );
  }
}

console.log(`\nTotal classificados na planilha: ${totalClass}`);
console.log(`Total ausentes na API:         ${totalAusentes}`);
if (totalAusentes === 0) {
  console.log('\nTodos os lançamentos classificados (letra ≠ N) estão na API.');
} else {
  console.log('\nPossíveis causas: letra inválida na importação, POST falhou, ou import não foi executado para esse banco.');
  console.log('Reimportar: npm run import:extrato-bancos-todos / import:extrato-cartoes-todos --substituir');
}

// API com conta mas letra mapeável
let apiSemLetra = 0;
for (const l of lancsBanco || []) {
  if (!contaLetra[l.contaContabilNome]) apiSemLetra++;
}
if (apiSemLetra) console.log(`\n(Aviso: ${apiSemLetra} lançamentos API sem codigo de conta mapeável)`);
