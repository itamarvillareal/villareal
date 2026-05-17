#!/usr/bin/env node
/**
 * Prompts 18–20: datas inválidas, auto-parear interbancário, duplicatas intra-banco.
 * Uso: node scripts/frente2-prompts-18-19-20.mjs [--executar-auto-parear]
 */

import './lib/load-vilareal-import-env.mjs';
import { writeFileSync } from 'fs';
import XLSX from 'xlsx';
import { BANCOS_IMPORT_PLANILHA } from './lib/extrato-bancos-planilha-constantes.mjs';
import {
  extrairLancamentosDaAba,
  layoutExtratoPorNomeInstituicao,
} from './lib/extrato-bancos-planilha-layouts.mjs';

const base = (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, '');
const senha = process.env.VILAREAL_IMPORT_SENHA || '123456';
const PLANILHA =
  process.argv.find((a) => a.endsWith('.xls') || a.endsWith('.xlsx')) ||
  '/Users/itamar/Downloads/Extratos Bancos - Itamar.xls';
const EXECUTAR_PAREAR = process.argv.includes('--executar-auto-parear');
const HOJE = new Date();
HOJE.setHours(0, 0, 0, 0);
const HOJE_ISO = fmtDate(HOJE);

const { accessToken } = await fetch(`${base}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ login: 'itamar', senha }),
}).then((r) => r.json());

const headers = { Authorization: `Bearer ${accessToken}` };

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function api(method, path, body) {
  const r = await fetch(`${base}${path}`, {
    method,
    headers: { ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { ok: r.ok, status: r.status, json };
}

async function fetchAllPaginated(pathBase) {
  const out = [];
  let page = 0;
  const size = 500;
  while (true) {
    const { ok, json } = await api('GET', `${pathBase}${pathBase.includes('?') ? '&' : '?'}page=${page}&size=${size}`);
    if (!ok) throw new Error(`${pathBase} ${json}`);
    out.push(...(json.content ?? []));
    if (page + 1 >= (json.totalPages ?? 1)) break;
    page += 1;
  }
  return out;
}

async function getLanc(id) {
  const { ok, json } = await api('GET', `/api/financeiro/lancamentos/${id}`);
  if (!ok) throw new Error(`GET ${id}`);
  return json;
}

async function putLanc(id, body) {
  return api('PUT', `/api/financeiro/lancamentos/${id}`, body);
}

function lancToPutBody(l, overrides = {}) {
  return {
    contaContabilId: l.contaContabilId,
    clienteId: l.clienteId ?? null,
    processoId: l.processoId ?? null,
    bancoNome: l.bancoNome,
    numeroBanco: l.numeroBanco,
    numeroLancamento: l.numeroLancamento,
    dataLancamento: l.dataLancamento,
    dataCompetencia: l.dataCompetencia ?? null,
    descricao: l.descricao,
    descricaoDetalhada: l.descricaoDetalhada ?? null,
    valor: l.valor,
    natureza: l.natureza,
    refTipo: l.refTipo ?? 'N',
    origem: l.origem ?? null,
    status: l.status ?? null,
    etapa: l.etapa ?? null,
    grupoCompensacao: l.grupoCompensacao ?? null,
    ...overrides,
  };
}

async function countInconsistentes() {
  const { json } = await api('GET', '/api/financeiro/lancamentos/grupos-compensacao/inconsistentes?page=0&size=1');
  return json?.total ?? 0;
}

// índice planilha por numeroLancamento
function buildPlanilhaIndex() {
  const wb = XLSX.readFile(PLANILHA, { cellDates: true });
  const byNumero = new Map();
  const byMatch = new Map();
  for (const bancoNome of BANCOS_IMPORT_PLANILHA) {
    const ws = wb.Sheets[bancoNome];
    if (!ws) continue;
    const layout = layoutExtratoPorNomeInstituicao(bancoNome);
    const rows = extrairLancamentosDaAba(ws, layout, bancoNome);
    for (const row of rows) {
      byNumero.set(row.numeroLancamento, { ...row, bancoNome });
      const k = `${bancoNome}|${row.valor}|${String(row.descricao).slice(0, 40)}`;
      if (!byMatch.has(k)) byMatch.set(k, []);
      byMatch.get(k).push(row);
    }
  }
  return { byNumero, byMatch };
}

// ========== PROMPT 18 ==========
console.log('\n# PROMPT 18 — Datas inválidas\n');
console.log('| id | data_atual | data_corrigida | fonte_da_correção | status |');

const invalidos = [];
let page = 0;
while (true) {
  const { json } = await api(
    'GET',
    `/api/financeiro/lancamentos/paginada?page=${page}&size=500&sort=dataLancamento,asc`
  );
  for (const l of json.content ?? []) {
    const d = l.dataLancamento;
    if (d < '2010-01-01' || d > HOJE_ISO) invalidos.push(l);
  }
  if (page + 1 >= json.totalPages) break;
  page += 1;
}

let planilhaIndex = null;
try {
  planilhaIndex = buildPlanilhaIndex();
} catch (e) {
  console.error('Planilha não indexada:', e.message);
}

const rel18 = [];

for (const l of invalidos) {
  let dataCorrigida = null;
  let fonte = '';
  let status = 'PENDENTE';

  const rowPlan = planilhaIndex?.byNumero.get(l.numeroLancamento);
  if (rowPlan && rowPlan.dataIso && rowPlan.dataIso !== '1900-01-01' && rowPlan.dataIso >= '2010-01-01') {
    dataCorrigida = rowPlan.dataIso;
    fonte = `planilha L${rowPlan.linhaExcel} ${rowPlan.bancoNome}`;
  } else if (l.dataLancamento === '1909-02-14' && l.bancoNome?.includes('Nubank')) {
    for (const cand of ['2019-02-14', '2020-02-14']) {
      const k = `Nubank|${Number(l.valor)}|${String(l.descricao).slice(0, 40)}`;
      const hits = (planilhaIndex?.byMatch.get(k) ?? []).filter((r) => r.dataIso === cand);
      if (hits.length) {
        dataCorrigida = cand;
        fonte = `planilha Nubank L${hits[0].linhaExcel} (${cand})`;
        break;
      }
    }
    if (!dataCorrigida) {
      fonte = 'investigar planilha Nubank: 1909 provável serial Excel (2019 ou 2020)';
    }
  } else if (l.dataLancamento > HOJE_ISO) {
    fonte = `data futura (hoje=${HOJE_ISO}); aguardar efetivação ou corrigir na origem`;
    status = 'PENDENTE';
  } else if (l.dataLancamento === '1900-01-01') {
    fonte = 'planilha sem data na linha (fallback import); revisar aba LANÇ MANUAIS (2)';
    status = 'PENDENTE';
  }

  if (dataCorrigida && dataCorrigida !== l.dataLancamento && dataCorrigida <= HOJE_ISO) {
    const full = await getLanc(l.id);
    const put = await putLanc(l.id, lancToPutBody(full, { dataLancamento: dataCorrigida }));
    status = put.ok ? 'CORRIGIDO' : `ERRO_PUT_${put.status}`;
  }

  rel18.push({ id: l.id, atual: l.dataLancamento, corrigida: dataCorrigida ?? '—', fonte, status });
  console.log(
    `| ${l.id} | ${l.dataLancamento} | ${dataCorrigida ?? '—'} | ${fonte || '—'} | ${status} |`
  );
}

writeFileSync('/tmp/prompt18-datas.json', JSON.stringify(rel18, null, 2));

// ========== PROMPT 19 ==========
console.log('\n\n# PROMPT 19 — Auto-parear interbancário\n');

const incAntes = await countInconsistentes();
console.log(`Grupos inconsistentes ANTES: ${incAntes}`);

const pares = [];
page = 0;
while (true) {
  const { json } = await api('GET', `/api/financeiro/lancamentos/pares-sugeridos?page=${page}&size=200`);
  if (!json.pares?.length) break;
  pares.push(...json.pares);
  if (page + 1 >= json.totalPages) break;
  page += 1;
}

const inter = pares.filter((p) => p.tipo === 'INTERBANCARIO');
console.log(`Pares sugeridos INTERBANCARIO: ${inter.length}`);

const csvLines = ['id_A,banco_A,id_B,banco_B,data,valor,descricao_A,descricao_B'];
const suspeitos = [];

for (const p of inter) {
  const a = p.lancamentoA;
  const b = p.lancamentoB;
  const data = a.dataLancamento;
  const valor = a.valor;
  csvLines.push(
    [
      a.id,
      a.bancoNome,
      b.id,
      b.bancoNome,
      data,
      valor,
      `"${(a.descricao ?? '').replace(/"/g, '""')}"`,
      `"${(b.descricao ?? '').replace(/"/g, '""')}"`,
    ].join(',')
  );
  if (a.numeroBanco === b.numeroBanco) suspeitos.push({ motivo: 'mesmo numeroBanco', a: a.id, b: b.id });
  if (Number(valor) < 0.1) suspeitos.push({ motivo: 'valor < 0.10', a: a.id, b: b.id, valor });
}

writeFileSync('/tmp/prompt19-pares-interbancario.csv', csvLines.join('\n'));
console.log(`Exportado: /tmp/prompt19-pares-interbancario.csv (${inter.length} pares)`);

console.log(`\nSuspeitos: ${suspeitos.length}`);
for (const s of suspeitos.slice(0, 15)) {
  console.log(`  ${s.motivo} ids ${s.a}/${s.b} valor=${s.valor ?? '—'}`);
}

const podeExecutar = suspeitos.filter((s) => s.motivo === 'mesmo numeroBanco').length === 0;

if (EXECUTAR_PAREAR && podeExecutar) {
  const dry = await api('POST', '/api/financeiro/lancamentos/auto-parear', {
    dryRun: true,
    tipo: 'INTERBANCARIO',
  });
  console.log(`\nDry-run confirmação: pares=${dry.json?.paresEncontrados} inter=${dry.json?.interbancarios}`);

  const exec = await api('POST', '/api/financeiro/lancamentos/auto-parear', {
    dryRun: false,
    tipo: 'INTERBANCARIO',
  });
  console.log(`EXECUTADO: paresEncontrados=${exec.json?.paresEncontrados} inter=${exec.json?.interbancarios}`);
  if (!exec.ok) console.log('Erro:', exec.json);

  const incDepois = await countInconsistentes();
  console.log(`Grupos inconsistentes DEPOIS: ${incDepois} (delta ${incDepois - incAntes})`);
} else if (EXECUTAR_PAREAR) {
  console.log('\nAuto-parear NÃO executado: há pares suspeitos (mesmo banco).');
} else {
  const dry = await api('POST', '/api/financeiro/lancamentos/auto-parear', {
    dryRun: true,
    tipo: 'INTERBANCARIO',
  });
  console.log(`\nDry-run: paresEncontrados=${dry.json?.paresEncontrados} (simulação=${dry.json?.simulacao})`);
  console.log('Para executar: node scripts/frente2-prompts-18-19-20.mjs --executar-auto-parear');
}

// ========== PROMPT 20 ==========
console.log('\n\n# PROMPT 20 — Duplicatas intra-banco (triagem)\n');

const todos = await fetchAllPaginated('/api/financeiro/lancamentos/paginada?');
const clusters = new Map();

for (const l of todos) {
  const banco = l.bancoNome ?? `nº${l.numeroBanco}`;
  const k = `${banco}|${l.dataLancamento}|${Number(l.valor).toFixed(2)}|${String(l.descricao ?? '').trim().toUpperCase()}`;
  if (!clusters.has(k)) clusters.set(k, []);
  clusters.get(k).push(l);
}

let totalEmClusters = 0;
let totalExcedente = 0;
let numClusters = 0;
const porBanco = new Map();
const topClusters = [];

for (const [, arr] of clusters) {
  if (arr.length < 2) continue;
  numClusters += 1;
  totalEmClusters += arr.length;
  const excedente = arr.length - 1;
  totalExcedente += excedente;
  const b = arr[0].bancoNome ?? '?';
  porBanco.set(b, (porBanco.get(b) ?? 0) + excedente);
  topClusters.push({
    banco: b,
    data: arr[0].dataLancamento,
    valor: Number(arr[0].valor),
    descricao: (arr[0].descricao ?? '').slice(0, 50),
    qtd: arr.length,
    excedente,
    score: Number(arr[0].valor) * excedente,
    ids: arr.map((x) => x.id),
  });
}

topClusters.sort((a, b) => b.score - a.score);

console.log(`Clusters duplicados (≥2): ${numClusters}`);
console.log(`Lançamentos em clusters: ${totalEmClusters}`);
console.log(`Lançamentos excedentes (soma qtd-1): ${totalExcedente}`);
console.log('\nExcedentes por banco:');
for (const [b, n] of [...porBanco.entries()].sort((a, c) => c[1] - a[1])) {
  console.log(`  ${b}: ${n}`);
}

console.log('\nTop 15 clusters (valor × excedente):');
console.log('| banco | data | valor | qtd | excedente | descrição |');
for (const c of topClusters.slice(0, 15)) {
  console.log(
    `| ${c.banco} | ${c.data} | ${c.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | ${c.qtd} | ${c.excedente} | ${c.descricao} |`
  );
}

writeFileSync('/tmp/prompt20-clusters.json', JSON.stringify(topClusters.slice(0, 100), null, 2));
console.error('\nConcluído.');
