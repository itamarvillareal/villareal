#!/usr/bin/env node
/**
 * Tarefas 18, 19 e investigação BTG Banking + ITI.
 * Uso: node scripts/executar-tarefas-18-19-investigacao.mjs
 */

import './lib/load-vilareal-import-env.mjs';
import { writeFileSync } from 'fs';
import XLSX from 'xlsx';
import { BANCOS_IMPORT_PLANILHA, NUMERO_PARA_BANCO } from './lib/extrato-bancos-planilha-constantes.mjs';
import {
  extrairLancamentosDaAba,
  layoutExtratoPorNomeInstituicao,
} from './lib/extrato-bancos-planilha-layouts.mjs';

const base = (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, '');
const senha = process.env.VILAREAL_IMPORT_SENHA || '123456';
import { requireExtratoBancosPlanilhaXlsPath } from './lib/resolve-extrato-bancos-planilha-xls.mjs';

const PLANILHA = requireExtratoBancosPlanilhaXlsPath();
const HOJE_ISO = '2026-05-17';

const { accessToken } = await fetch(`${base}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ login: 'itamar', senha }),
}).then((r) => r.json());

const headers = { Authorization: `Bearer ${accessToken}` };

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
    json = { raw: text?.slice(0, 500) };
  }
  return { ok: r.ok, status: r.status, json };
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

function buildPlanilhaIndex() {
  const wb = XLSX.readFile(PLANILHA, { cellDates: true });
  const byNumero = new Map();
  const byBancoMes = new Map();
  for (const bancoNome of BANCOS_IMPORT_PLANILHA) {
    const ws = wb.Sheets[bancoNome];
    if (!ws) continue;
    const layout = layoutExtratoPorNomeInstituicao(bancoNome);
    const rows = extrairLancamentosDaAba(ws, layout, bancoNome);
    for (const row of rows) {
      byNumero.set(row.numeroLancamento, { ...row, bancoNome });
      const ym = String(row.dataIso).slice(0, 7);
      const k = `${bancoNome}|${ym}`;
      byBancoMes.set(k, (byBancoMes.get(k) ?? 0) + 1);
    }
  }
  return { byNumero, byBancoMes };
}

function chaveDup(l) {
  const banco = l.bancoNome ?? `nº${l.numeroBanco}`;
  return `${banco}|${l.dataLancamento}|${Number(l.valor).toFixed(2)}|${String(l.descricao ?? '').trim().toUpperCase()}`;
}

function idsConsecutivos(ids) {
  const sorted = [...ids].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] > 5) return false;
  }
  return true;
}

// ==================== TAREFA 1 ====================
console.log('\n# TAREFA 1 — Corrigir datas inválidas\n');
console.log('| id | data_atual | data_corrigida | fonte | status |');

const invalidos = [];
let page = 0;
while (true) {
  const { json } = await api(
    'GET',
    `/api/financeiro/lancamentos/paginada?page=${page}&size=500&sort=id,asc`
  );
  for (const l of json.content ?? []) {
    const d = l.dataLancamento;
    if (d < '2010-01-01' || d > HOJE_ISO) invalidos.push(l);
  }
  if (page + 1 >= (json.totalPages ?? 1)) break;
  page += 1;
}

const planilha = buildPlanilhaIndex();
const rel18 = [];

for (const l of invalidos) {
  let dataCorrigida = '—';
  let fonte = '—';
  let status = 'PENDENTE';

  if (l.dataLancamento > HOJE_ISO) {
    fonte = `data após ${HOJE_ISO}; lançamento futuro/previsto ou erro na origem`;
    status = 'PENDENTE';
    rel18.push({ id: l.id, atual: l.dataLancamento, corrigida: dataCorrigida, fonte, status, banco: l.bancoNome, valor: l.valor, desc: l.descricao });
    console.log(`| ${l.id} | ${l.dataLancamento} | — | ${fonte} | ${status} |`);
    continue;
  }

  const rowPlan = planilha.byNumero.get(l.numeroLancamento);
  if (rowPlan?.dataIso && rowPlan.dataIso !== '1900-01-01' && rowPlan.dataIso >= '2010-01-01' && rowPlan.dataIso <= HOJE_ISO) {
    dataCorrigida = rowPlan.dataIso;
    fonte = `planilha ${rowPlan.bancoNome} L${rowPlan.linhaExcel}`;
  } else if (l.dataLancamento === '1909-02-14' && String(l.bancoNome).includes('Nubank')) {
    const v = Number(l.valor);
    const desc = String(l.descricao).slice(0, 40);
    for (const cand of ['2019-02-14', '2020-02-14']) {
      const rows = [...planilha.byNumero.values()].filter(
        (r) =>
          r.bancoNome === 'Nubank' &&
          r.dataIso === cand &&
          Math.abs(Number(r.valor) - v) < 0.02 &&
          String(r.descricao).slice(0, 40) === desc
      );
      if (rows.length) {
        dataCorrigida = cand;
        fonte = `planilha Nubank L${rows[0].linhaExcel} (${cand})`;
        break;
      }
    }
    if (dataCorrigida === '—') {
      fonte = 'planilha: sem match 2019/2020; 1909 provável serial Excel';
    }
  } else if (l.dataLancamento === '1900-01-01') {
    fonte = rowPlan
      ? `planilha sem data válida (dataIso=${rowPlan.dataIso})`
      : 'numeroLancamento não encontrado na planilha de extratos';
    status = 'PENDENTE';
  }

  if (dataCorrigida !== '—' && dataCorrigida !== l.dataLancamento) {
    const full = (await api('GET', `/api/financeiro/lancamentos/${l.id}`)).json;
    const put = await api('PUT', `/api/financeiro/lancamentos/${l.id}`, lancToPutBody(full, { dataLancamento: dataCorrigida }));
    status = put.ok ? 'CORRIGIDO' : `ERRO_${put.status}`;
  }

  rel18.push({ id: l.id, atual: l.dataLancamento, corrigida: dataCorrigida, fonte, status });
  console.log(`| ${l.id} | ${l.dataLancamento} | ${dataCorrigida} | ${fonte} | ${status} |`);
}

console.log('\n### Datas futuras (detalhe, sem correção)\n');
console.log('| id | data | valor | descrição | banco |');
for (const r of rel18.filter((x) => x.atual > HOJE_ISO)) {
  console.log(`| ${r.id} | ${r.atual} | ${r.valor} | ${(r.desc ?? '').slice(0, 50)} | ${r.banco} |`);
}

// ==================== TAREFA 2 ====================
console.log('\n\n# TAREFA 2 — Auto-parear interbancário\n');

const incAntes = (await api('GET', '/api/financeiro/lancamentos/grupos-compensacao/inconsistentes?page=0&size=1')).json?.total ?? '?';
console.log(`Grupos inconsistentes ANTES: ${incAntes}`);

const pares = [];
page = 0;
while (true) {
  const { json } = await api('GET', `/api/financeiro/lancamentos/pares-sugeridos?page=${page}&size=200`);
  if (!json.pares?.length) break;
  pares.push(...json.pares.filter((p) => p.tipo === 'INTERBANCARIO'));
  if (page + 1 >= json.totalPages) break;
  page += 1;
}

console.log(`\nPares INTERBANCARIO sugeridos: ${pares.length}\n`);
console.log('### Amostra — primeiros 20 pares\n');
console.log('| id_A | banco_A | id_B | banco_B | data | valor | descrição_A | descrição_B |');
for (const p of pares.slice(0, 20)) {
  const a = p.lancamentoA;
  const b = p.lancamentoB;
  console.log(
    `| ${a.id} | ${a.bancoNome} | ${b.id} | ${b.bancoNome} | ${a.dataLancamento} | ${a.valor} | ${(a.descricao ?? '').slice(0, 35)} | ${(b.descricao ?? '').slice(0, 35)} |`
  );
}

const suspeitos = [];
for (const p of pares) {
  const a = p.lancamentoA;
  const b = p.lancamentoB;
  if (a.numeroBanco != null && a.numeroBanco === b.numeroBanco) suspeitos.push({ motivo: 'mesmo numeroBanco', ids: [a.id, b.id] });
  if (Number(a.valor) < 0.1) suspeitos.push({ motivo: 'valor < 0.10', ids: [a.id, b.id], valor: a.valor });
  const da = String(a.descricao ?? '').toLowerCase();
  const db = String(b.descricao ?? '').toLowerCase();
  if (/rend|juros|irrf|iof/.test(da) && /rend|juros|irrf|iof/.test(db)) {
    suspeitos.push({ motivo: 'possível rendimento/tarifa', ids: [a.id, b.id] });
  }
}

console.log(`\n### Verificação suspeitos: ${suspeitos.length}\n`);
for (const s of suspeitos.slice(0, 20)) {
  console.log(`- ${s.motivo}: ${s.ids.join('/')}${s.valor != null ? ` R$${s.valor}` : ''}`);
}

const bloqueioMesmoBanco = suspeitos.some((s) => s.motivo === 'mesmo numeroBanco');
let parearResult = null;

if (!bloqueioMesmoBanco) {
  parearResult = await api('POST', '/api/financeiro/lancamentos/auto-parear', {
    dryRun: false,
    tipo: 'INTERBANCARIO',
  });
  console.log('\n### Execução auto-parear\n');
  console.log(`OK: ${parearResult.ok}`);
  console.log(`paresEncontrados: ${parearResult.json?.paresEncontrados ?? '—'}`);
  console.log(`interbancarios: ${parearResult.json?.interbancarios ?? '—'}`);
  if (parearResult.json?.erros?.length) console.log('erros:', parearResult.json.erros);
} else {
  console.log('\nAuto-parear NÃO executado: par(es) com mesmo numeroBanco.');
}

const incDepois = (await api('GET', '/api/financeiro/lancamentos/grupos-compensacao/inconsistentes?page=0&size=1')).json?.total ?? '?';
console.log(`\nGrupos inconsistentes DEPOIS: ${incDepois} (delta: ${incAntes !== '?' && incDepois !== '?' ? incDepois - incAntes : '—'})`);

// ==================== TAREFA 3 ====================
console.log('\n\n# TAREFA 3 — Investigar import duplicado (BTG Banking + ITI)\n');

const bancosInvestigar = [
  { nome: 'BTG Banking', meses: ['2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06', '2024-07', '2024-08'] },
  { nome: 'ITI', meses: ['2024-10'] },
];

const apiPorBancoMes = new Map();
page = 0;
while (true) {
  const { json } = await api('GET', `/api/financeiro/lancamentos/paginada?page=${page}&size=2000&sort=id,asc`);
  for (const l of json.content ?? []) {
    const b = l.bancoNome ?? '';
    const ym = String(l.dataLancamento).slice(0, 7);
    const k = `${b}|${ym}`;
    if (!apiPorBancoMes.has(k)) apiPorBancoMes.set(k, []);
    apiPorBancoMes.get(k).push(l);
  }
  if (page + 1 >= (json.totalPages ?? 1)) break;
  page += 1;
}

const dupClustersInvest = [];

for (const { nome, meses } of bancosInvestigar) {
  console.log(`\n## ${nome}\n`);
  console.log('| mês | qtd_planilha | qtd_api | diferença |');
  for (const ym of meses) {
    const qtdPlan = planilha.byBancoMes.get(`${nome}|${ym}`) ?? 0;
    const qtdApi = (apiPorBancoMes.get(`${nome}|${ym}`) ?? []).length;
    const diff = qtdApi - qtdPlan;
    console.log(`| ${ym} | ${qtdPlan} | ${qtdApi} | ${diff >= 0 ? '+' : ''}${diff} |`);
  }

  const lancsMes = meses.flatMap((ym) => apiPorBancoMes.get(`${nome}|${ym}`) ?? []);
  const clusters = new Map();
  for (const l of lancsMes) {
    const k = chaveDup(l);
    if (!clusters.has(k)) clusters.set(k, []);
    clusters.get(k).push(l);
  }

  const dups = [...clusters.entries()].filter(([, a]) => a.length >= 2);
  console.log(`\n### Clusters duplicados (${dups.length})\n`);
  console.log('| data | valor | qtd | ids | consecutivos? | excedentes sugeridos |');
  for (const [, arr] of dups.sort((a, b) => b[1].length - a[1].length).slice(0, 25)) {
    const ids = arr.map((l) => l.id).sort((a, b) => a - b);
    const consec = idsConsecutivos(ids);
    const sorted = [...arr].sort((a, b) => a.id - b.id);
    const manter = sorted[0];
    const excedentes = sorted.slice(1).map((l) => l.id);
    console.log(
      `| ${arr[0].dataLancamento} | ${Number(arr[0].valor).toLocaleString('pt-BR')} | ${arr.length} | ${ids.join(',')} | ${consec ? 'SIM' : 'NÃO'} | ${excedentes.join(',')} |`
    );
    dupClustersInvest.push({ banco: nome, ids, consec, excedentes });
  }

  const diffPositiva = meses.filter((ym) => {
    const p = planilha.byBancoMes.get(`${nome}|${ym}`) ?? 0;
    const a = (apiPorBancoMes.get(`${nome}|${ym}`) ?? []).length;
    return a > p * 1.1 && a - p >= 3;
  });
  if (diffPositiva.length) {
    console.log(`\n**Indício import duplicado:** API > planilha em ${diffPositiva.join(', ')}`);
  }
}

writeFileSync('/tmp/tarefas-18-19-investigacao.json', JSON.stringify({ rel18, incAntes, incDepois, parearResult: parearResult?.json, dupClustersInvest }, null, 2));
console.error('\nJSON: /tmp/tarefas-18-19-investigacao.json');
