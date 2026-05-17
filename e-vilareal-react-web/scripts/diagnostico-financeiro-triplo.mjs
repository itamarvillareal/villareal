#!/usr/bin/env node
/** Diagnóstico triplo: órfãos E, anomalias data/valor, consistência letra×descrição. Somente leitura. */

import './lib/load-vilareal-import-env.mjs';
import { buildContaNomeParaLetra } from './lib/financeiro-api-conta-map.mjs';

const base = (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, '');
const senha = process.env.VILAREAL_IMPORT_SENHA || '123456';
const CONTA_E_ID = 6;
const TOL_VALOR = 0.02;
const JANELA_DU3 = 3;
const JANELA_DU5 = 5;
const HOJE = new Date();
HOJE.setHours(0, 0, 0, 0);

const { accessToken } = await fetch(`${base}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ login: 'itamar', senha }),
}).then((r) => r.json());

const headers = { Authorization: `Bearer ${accessToken}` };

async function fetchAllLancamentos() {
  const out = [];
  let page = 0;
  const size = 5000;
  while (true) {
    const url = `${base}/api/financeiro/lancamentos/paginada?page=${page}&size=${size}&sort=dataLancamento,asc`;
    const r = await fetch(url, { headers });
    if (!r.ok) throw new Error(`paginada ${r.status}: ${await r.text()}`);
    const data = await r.json();
    const chunk = data.content ?? data;
    out.push(...chunk);
    const totalPages = data.totalPages ?? 1;
    if (page + 1 >= totalPages || chunk.length === 0) break;
    page += 1;
    process.stderr.write(`  … página ${page + 1}/${totalPages} (${out.length} lançamentos)\n`);
  }
  return out;
}

console.error('Carregando lançamentos (paginado)…');
const todos = await fetchAllLancamentos();
console.error(`Total carregado: ${todos.length}`);

const contas = await fetch(`${base}/api/financeiro/contas`, { headers }).then((r) => r.json());
const contaLetra = buildContaNomeParaLetra(contas);
const contaIdParaLetra = {};
for (const c of contas || []) {
  contaIdParaLetra[c.id] = String(c.codigo ?? '').trim().toUpperCase();
}

const lancsE = todos.filter((l) => l.contaContabilId === CONTA_E_ID);

// --- helpers ---
function parseDate(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function isWeekend(d) {
  const w = d.getDay();
  return w === 0 || w === 6;
}

function diasUteisEntre(a, b) {
  let start = a <= b ? new Date(a) : new Date(b);
  let end = a <= b ? new Date(b) : new Date(a);
  let n = 0;
  const cur = new Date(start);
  cur.setDate(cur.getDate() + 1);
  while (cur <= end) {
    if (!isWeekend(cur)) n += 1;
    cur.setDate(cur.getDate() + 1);
  }
  return n;
}

function valorAssinado(l) {
  const v = Number(l.valor) || 0;
  return String(l.natureza ?? '').toUpperCase() === 'DEBITO' ? -v : v;
}

function chaveValor(v) {
  return (Math.round(Math.abs(v) * 100) / 100).toFixed(2);
}

function mesmoBanco(a, b) {
  if (a.numeroBanco != null && b.numeroBanco != null) return a.numeroBanco === b.numeroBanco;
  const na = String(a.bancoNome ?? '').trim().toUpperCase();
  const nb = String(b.bancoNome ?? '').trim().toUpperCase();
  return na && nb && na === nb;
}

function valoresOpostos(a, b) {
  const sa = valorAssinado(a);
  const sb = valorAssinado(b);
  return Math.abs(sa + sb) <= TOL_VALOR && Math.abs(sa) > TOL_VALOR;
}

function dentroJanelaDU(dataA, dataB, maxDu) {
  return diasUteisEntre(parseDate(dataA), parseDate(dataB)) <= maxDu;
}

function letraDe(l) {
  return contaIdParaLetra[l.contaContabilId] ?? contaLetra[l.contaContabilNome] ?? '?';
}

function normDesc(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\d+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function bancoLabel(l) {
  return l.bancoNome ?? `nº${l.numeroBanco ?? '?'}`;
}

function fmtValor(v) {
  return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// índice por valor
const porValor = new Map();
for (const l of todos) {
  const k = chaveValor(Number(l.valor));
  if (!porValor.has(k)) porValor.set(k, []);
  porValor.get(k).push(l);
}

// membros grupo (todos E)
const membrosGrupoE = new Map();
for (const l of lancsE) {
  const g = String(l.grupoCompensacao ?? '').trim();
  if (!g) continue;
  if (!membrosGrupoE.has(g)) membrosGrupoE.set(g, []);
  membrosGrupoE.get(g).push(l);
}

// membros grupo (todos lançamentos, para PAR_INCOMPLETO)
const membrosGrupoAll = new Map();
for (const l of todos) {
  const g = String(l.grupoCompensacao ?? '').trim();
  if (!g) continue;
  if (!membrosGrupoAll.has(g)) membrosGrupoAll.set(g, []);
  membrosGrupoAll.get(g).push(l);
}

function pareadoConfianca(e) {
  const g = String(e.grupoCompensacao ?? '').trim();
  if (g) {
    const membros = membrosGrupoE.get(g) ?? [];
    if (membros.length >= 2) {
      const bancos = new Set(membros.map((m) => m.numeroBanco ?? m.bancoNome));
      if (bancos.size >= 2) {
        const soma = membros.reduce((s, m) => s + valorAssinado(m), 0);
        if (Math.abs(soma) <= TOL_VALOR) return { tipo: 'GRUPO_OK' };
      }
    }
  }
  const k = chaveValor(Number(e.valor));
  const candidatos3 = (porValor.get(k) ?? []).filter(
    (c) =>
      c.id !== e.id &&
      !mesmoBanco(e, c) &&
      valoresOpostos(e, c) &&
      dentroJanelaDU(e.dataLancamento, c.dataLancamento, JANELA_DU3)
  );
  if (candidatos3.length === 1) return { tipo: 'PAR_UNICO' };
  if (candidatos3.length > 1) return { tipo: 'AMBIGUO', candidatos: candidatos3 };
  return { tipo: 'ORFAO' };
}

function candidatosCross(e, maxDu) {
  const k = chaveValor(Number(e.valor));
  return (porValor.get(k) ?? []).filter(
    (c) =>
      c.id !== e.id &&
      !mesmoBanco(e, c) &&
      valoresOpostos(e, c) &&
      dentroJanelaDU(e.dataLancamento, c.dataLancamento, maxDu)
  );
}

function grupoMesmoBanco(e) {
  const g = String(e.grupoCompensacao ?? '').trim();
  if (!g) return false;
  const membros = membrosGrupoE.get(g) ?? membrosGrupoAll.get(g) ?? [];
  if (membros.length < 2) return false;
  return membros.some((m) => m.id !== e.id && mesmoBanco(e, m));
}

function classificarOrfao(e) {
  const g = String(e.grupoCompensacao ?? '').trim();
  if (g) {
    const membros = membrosGrupoAll.get(g) ?? [];
    if (membros.length <= 1) return 'PAR_INCOMPLETO';
    if (grupoMesmoBanco(e)) return 'PAR_MESMO_BANCO';
    const outrosBanco = membros.filter((m) => m.id !== e.id && !mesmoBanco(e, m));
    if (outrosBanco.length === 0) return 'PAR_MESMO_BANCO';
    return 'PAR_INCOMPLETO';
  }
  const c5 = candidatosCross(e, JANELA_DU5);
  if (c5.length >= 1) return 'SEM_GRUPO_COM_CANDIDATO';
  return 'SEM_GRUPO_SEM_CANDIDATO';
}

// ========== ANÁLISE 1 ==========
console.log('\n# ANÁLISE 1 — Segmentação de órfãos E\n');

const orfaos = [];
const ambiguosList = [];

for (const e of lancsE) {
  const p = pareadoConfianca(e);
  if (p.tipo === 'ORFAO') orfaos.push(e);
  if (p.tipo === 'AMBIGUO') ambiguosList.push(e);
}

const causas = {
  PAR_MESMO_BANCO: { qtd: 0, valorAbs: 0, ids: [] },
  PAR_INCOMPLETO: { qtd: 0, valorAbs: 0, ids: [] },
  SEM_GRUPO_COM_CANDIDATO: { qtd: 0, valorAbs: 0, ids: [] },
  SEM_GRUPO_SEM_CANDIDATO: { qtd: 0, valorAbs: 0, ids: [] },
  AMBIGUO: { qtd: 0, valorAbs: 0, ids: [] },
};

const acoes = {
  PAR_MESMO_BANCO: 'Revisar pareamento interno (mesmo banco); considerar desparear e parear cross-banco',
  PAR_INCOMPLETO: 'Completar grupo ou desparear e re-parear',
  SEM_GRUPO_COM_CANDIDATO: 'POST parear manual ou auto-parear (janela ampliada)',
  SEM_GRUPO_SEM_CANDIDATO: 'Investigar contrapartida em conta N ou banco não importado',
  AMBIGUO: 'Escolher par manualmente entre candidatos',
};

for (const e of orfaos) {
  const causa = classificarOrfao(e);
  causas[causa].qtd += 1;
  causas[causa].valorAbs += Math.abs(Number(e.valor) || 0);
  causas[causa].ids.push(e.id);
}

for (const e of ambiguosList) {
  causas.AMBIGUO.qtd += 1;
  causas.AMBIGUO.valorAbs += Math.abs(Number(e.valor) || 0);
  causas.AMBIGUO.ids.push(e.id);
}

console.log('| causa | quantidade | valor_absoluto_total | ação_sugerida |');
console.log('|-------|------------|---------------------:|---------------|');
for (const [causa, d] of Object.entries(causas)) {
  if (d.qtd === 0 && causa !== 'AMBIGUO') continue;
  console.log(
    `| ${causa} | ${d.qtd} | ${d.valorAbs.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | ${acoes[causa]} |`
  );
}
console.log(`\nÓrfãos ±3 DU: ${orfaos.length} | Ambíguos ±3 DU: ${ambiguosList.length}`);

// dry-run auto-parear
console.log('\n### Auto-parear dry-run (INTERBANCARIO)\n');
const autoRes = await fetch(`${base}/api/financeiro/lancamentos/auto-parear`, {
  method: 'POST',
  headers: { ...headers, 'Content-Type': 'application/json' },
  body: JSON.stringify({ dryRun: true, tipo: 'INTERBANCARIO' }),
}).then((r) => r.json());

console.log(`Pares encontrados (API): ${autoRes.paresEncontrados ?? '—'}`);
console.log(`Interbancários: ${autoRes.interbancarios ?? '—'}`);
console.log(`Mesmo banco: ${autoRes.mesmoBanco ?? '—'}`);
console.log(`Simulação (dry-run): ${autoRes.simulacao !== false ? 'sim' : 'não'}`);
const semGrupoCand = causas.SEM_GRUPO_COM_CANDIDATO.qtd;
console.log(
  `SEM_GRUPO_COM_CANDIDATO (análise local ±5 DU): ${semGrupoCand} — auto-parear API cobre pares sugeridos sem grupo (critério próprio da API)`
);

// ========== ANÁLISE 2 ==========
console.log('\n\n# ANÁLISE 2 — Anomalias de data e valor\n');

const alertasData = [];
const alertasMes = [];
const alertasGap = [];
const alertasZero = [];
const alertasTopValor = [];
const alertasDup = [];

for (const l of todos) {
  const d = parseDate(l.dataLancamento);
  const v = Number(l.valor) || 0;
  const desc = (l.descricao ?? '').slice(0, 60);
  const banco = bancoLabel(l);

  if (d < parseDate('2010-01-01') || d > HOJE) {
    alertasData.push({
      banco,
      data: l.dataLancamento,
      valor: v,
      descricao: desc,
      motivo: d > HOJE ? 'Data futura' : d < parseDate('2010-01-01') ? 'Data anterior a 2010' : 'Data inválida',
    });
  }
  if (Math.abs(v) < TOL_VALOR) {
    alertasZero.push({ banco, data: l.dataLancamento, valor: v, descricao: desc, motivo: 'Valor zero' });
  }
}

// meses por banco
const porBancoMes = new Map();
for (const l of todos) {
  const b = bancoLabel(l);
  const ym = String(l.dataLancamento).slice(0, 7);
  const key = `${b}|${ym}`;
  porBancoMes.set(key, (porBancoMes.get(key) ?? 0) + 1);
}

const porBanco = new Map();
for (const [key, cnt] of porBancoMes) {
  const [b] = key.split('|');
  if (!porBanco.has(b)) porBanco.set(b, []);
  porBanco.get(b).push(cnt);
}

for (const [key, cnt] of porBancoMes) {
  const [b, ym] = key.split('|');
  const arr = porBanco.get(b) ?? [];
  if (arr.length < 3) continue;
  const mean = arr.reduce((s, x) => s + x, 0) / arr.length;
  const variance = arr.reduce((s, x) => s + (x - mean) ** 2, 0) / arr.length;
  const std = Math.sqrt(variance) || 1;
  if (Math.abs(cnt - mean) > 2 * std) {
    alertasMes.push({
      banco: b,
      data: ym,
      valor: cnt,
      descricao: `média=${mean.toFixed(0)} σ=${std.toFixed(0)}`,
      motivo: cnt > mean ? 'Mês com volume muito acima da média' : 'Mês com volume muito abaixo da média',
    });
  }
}

// gaps > 60 dias por banco (bancos com movimento recorrente)
for (const b of new Set(todos.map(bancoLabel))) {
  const dates = [
    ...new Set(
      todos.filter((l) => bancoLabel(l) === b).map((l) => l.dataLancamento)
    ),
  ].sort();
  if (dates.length < 6) continue;
  for (let i = 1; i < dates.length; i++) {
    const gap = (parseDate(dates[i]) - parseDate(dates[i - 1])) / 86400000;
    if (gap > 60) {
      alertasGap.push({
        banco: b,
        data: `${dates[i - 1]} → ${dates[i]}`,
        valor: gap,
        descricao: `${Math.round(gap)} dias sem lançamento`,
        motivo: 'Gap > 60 dias',
      });
    }
  }
}

// top 20 por banco
const porBancoVals = new Map();
for (const l of todos) {
  const b = bancoLabel(l);
  if (!porBancoVals.has(b)) porBancoVals.set(b, []);
  porBancoVals.get(b).push(l);
}
for (const [b, arr] of porBancoVals) {
  const top = [...arr].sort((a, b) => Math.abs(Number(b.valor)) - Math.abs(Number(a.valor))).slice(0, 20);
  for (const l of top) {
    alertasTopValor.push({
      banco: b,
      data: l.dataLancamento,
      valor: Number(l.valor),
      descricao: (l.descricao ?? '').slice(0, 60),
      motivo: 'Top valor absoluto do banco',
    });
  }
}

// duplicata intra-banco
const dupKey = new Map();
for (const l of todos) {
  const k = `${bancoLabel(l)}|${l.dataLancamento}|${chaveValor(Number(l.valor))}|${String(l.descricao ?? '').trim().toUpperCase()}`;
  if (!dupKey.has(k)) dupKey.set(k, []);
  dupKey.get(k).push(l);
}
for (const [, arr] of dupKey) {
  if (arr.length < 2) continue;
  for (const l of arr) {
    alertasDup.push({
      banco: bancoLabel(l),
      data: l.dataLancamento,
      valor: Number(l.valor),
      descricao: (l.descricao ?? '').slice(0, 60),
      motivo: `Duplicata intra-banco (${arr.length}×)`,
    });
  }
}

function printTabela(titulo, rows, limit = 50) {
  console.log(`\n### ${titulo} (${rows.length} registros${rows.length > limit ? `, mostrando ${limit}` : ''})\n`);
  console.log('| banco | data | valor | descrição | motivo_do_alerta |');
  console.log('|-------|------|------:|-----------|------------------|');
  for (const r of rows.slice(0, limit)) {
    const val =
      typeof r.valor === 'number' && r.valor > 100
        ? r.valor.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
        : fmtValor(r.valor);
    console.log(`| ${r.banco} | ${r.data} | ${val} | ${r.descricao} | ${r.motivo} |`);
  }
}

printTabela('Datas inválidas (< 2010 ou futuras)', alertasData.sort((a, b) => a.data.localeCompare(b.data)), 80);
printTabela('Meses com volume anômalo (>2σ)', alertasMes.sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor)), 40);
printTabela('Gaps > 60 dias', alertasGap.sort((a, b) => b.valor - a.valor), 30);
printTabela('Valor zero', alertasZero, 30);
printTabela('Top 20 maiores valores por banco (amostra)', alertasTopValor.slice(0, 80), 80);
printTabela('Duplicatas intra-banco (amostra)', alertasDup.slice(0, 60), 60);

// ========== ANÁLISE 3 ==========
console.log('\n\n# ANÁLISE 3 — Consistência letra × descrição\n');

const porDesc = new Map();
for (const l of todos) {
  const nd = normDesc(l.descricao);
  if (!nd || nd.length < 3) continue;
  if (!porDesc.has(nd)) porDesc.set(nd, []);
  porDesc.get(nd).push(l);
}

const inconsistentes = [];
for (const [nd, arr] of porDesc) {
  if (arr.length <= 5) continue;
  const porLetra = new Map();
  for (const l of arr) {
    const lt = letraDe(l);
    porLetra.set(lt, (porLetra.get(lt) ?? 0) + 1);
  }
  if (porLetra.size < 2) continue;
  const sorted = [...porLetra.entries()].sort((a, b) => b[1] - a[1]);
  const [dom, domQtd] = sorted[0];
  const minor = sorted.slice(1);
  const minorTotal = minor.reduce((s, [, q]) => s + q, 0);
  if (minorTotal < 1) continue;
  const score = minorTotal / arr.length;
  inconsistentes.push({
    nd,
    total: arr.length,
    dominante: dom,
    domPct: ((100 * domQtd) / arr.length).toFixed(1),
    minor: minor.map(([l, q]) => `${l}(${q})`).join(', '),
    score,
    exemplos: minor
      .flatMap(([letra]) =>
        arr
          .filter((l) => letraDe(l) === letra)
          .slice(0, 2)
          .map((l) => `${bancoLabel(l)} ${l.dataLancamento} R$${fmtValor(l.valor)}`)
      )
      .slice(0, 4),
  });
}

inconsistentes.sort((a, b) => b.score - a.score || b.total - a.total);

console.log('| descrição_normalizada | total | letra_dominante (%) | letras_minoritárias | exemplos |');
console.log('|-------------------------|------:|--------------------|---------------------|----------|');
for (const r of inconsistentes.slice(0, 20)) {
  const ex = r.exemplos.join('; ').slice(0, 80);
  console.log(
    `| ${r.nd.slice(0, 45)} | ${r.total} | ${r.dominante} (${r.domPct}%) | ${r.minor} | ${ex} |`
  );
}

console.error('\nDiagnóstico concluído.');
