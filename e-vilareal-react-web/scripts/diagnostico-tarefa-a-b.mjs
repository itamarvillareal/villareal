#!/usr/bin/env node
/** Tarefa A (auto-parear 0) + Tarefa B1/B2 — somente diagnóstico. */

import './lib/load-vilareal-import-env.mjs';
import { buildContaNomeParaLetra } from './lib/financeiro-api-conta-map.mjs';

const base = (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, '');
const senha = process.env.VILAREAL_IMPORT_SENHA || '123456';
const LETRAS = ['A', 'B', 'C', 'D', 'E', 'F', 'I', 'J', 'M', 'P', 'R'];
const TOL_VALOR_REC = 0.1;

const { accessToken } = await fetch(`${base}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ login: 'itamar', senha }),
}).then((r) => r.json());

const headers = { Authorization: `Bearer ${accessToken}` };

async function fetchAll() {
  const out = [];
  let page = 0;
  while (true) {
    const r = await fetch(
      `${base}/api/financeiro/lancamentos/paginada?page=${page}&size=2000&sort=id,asc`,
      { headers }
    );
    const data = await r.json();
    out.push(...(data.content ?? []));
    if (page + 1 >= (data.totalPages ?? 1)) break;
    page += 1;
  }
  return out;
}

function normDesc(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\d+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(s) {
  return normDesc(s)
    .split(/\s+/)
    .filter((t) => t.length >= 3);
}

function letraDe(l, contaLetra, idLetra) {
  return idLetra[l.contaContabilId] ?? contaLetra[l.contaContabilNome] ?? '?';
}

function percentil(arr, p) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const i = Math.floor((p / 100) * (s.length - 1));
  return s[i];
}

function semGrupo(l) {
  return !String(l.grupoCompensacao ?? '').trim();
}

function parseYm(iso) {
  return String(iso).slice(0, 7);
}

console.error('Carregando…');
const [todos, contas] = await Promise.all([
  fetchAll(),
  fetch(`${base}/api/financeiro/contas`, { headers }).then((r) => r.json()),
]);
const contaLetra = buildContaNomeParaLetra(contas);
const idLetra = {};
for (const c of contas) idLetra[c.id] = String(c.codigo ?? '').trim().toUpperCase();

// ========== TAREFA A ==========
console.log('\n# TAREFA A — Por que auto-parear retorna 0 pares\n');

const eSemGrupo = todos.filter((l) => letraDe(l, contaLetra, idLetra) === 'E' && semGrupo(l));
const porEtapaE = new Map();
for (const l of eSemGrupo) {
  const e = l.etapa ?? '(null)';
  porEtapaE.set(e, (porEtapaE.get(e) ?? 0) + 1);
}

console.log('## Distribuição E sem grupo por etapa\n');
console.log('| etapa | quantidade | % |');
console.log('|-------|----------:|--:|');
const totalEsg = eSemGrupo.length;
for (const [e, n] of [...porEtapaE.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`| ${e} | ${n} | ${((100 * n) / totalEsg).toFixed(1)}% |`);
}

const elegivelSql = (l) =>
  semGrupo(l) && ['IMPORTADO', 'CLASSIFICADO'].includes(String(l.etapa ?? '').toUpperCase());

const poolSql = todos.filter(elegivelSql);
const porLetraPool = new Map();
for (const l of poolSql) {
  const lt = letraDe(l, contaLetra, idLetra);
  porLetraPool.set(lt, (porLetraPool.get(lt) ?? 0) + 1);
}

console.log('\n## Pool elegível pela query atual (sem grupo + etapa IMPORTADO/CLASSIFICADO)\n');
console.log('| letra | quantidade |');
for (const [lt, n] of [...porLetraPool.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`| ${lt} | ${n} |`);
}

// simular SQL: mesma data, valor, natureza oposta, id a<b, sem grupo, etapas ok
const byDateValor = new Map();
for (const l of poolSql) {
  const k = `${l.dataLancamento}|${Number(l.valor).toFixed(2)}`;
  if (!byDateValor.has(k)) byDateValor.set(k, []);
  byDateValor.get(k).push(l);
}

let paresSimulados = 0;
let paresInter = 0;
let paresComE = 0;
for (const [, arr] of byDateValor) {
  const creditos = arr.filter((l) => String(l.natureza).toUpperCase() === 'CREDITO');
  const debitos = arr.filter((l) => String(l.natureza).toUpperCase() === 'DEBITO');
  for (const a of creditos) {
    for (const b of debitos) {
      if (a.id >= b.id) continue;
      paresSimulados += 1;
      if (a.numeroBanco !== b.numeroBanco) paresInter += 1;
      if (letraDe(a, contaLetra, idLetra) === 'E' || letraDe(b, contaLetra, idLetra) === 'E') paresComE += 1;
    }
  }
}

console.log('\n## Simulação local da query (mesma data + valor + natureza oposta)\n');
console.log(`Pares totais (qualquer letra): ${paresSimulados}`);
console.log(`Pares interbancários (numeroBanco diferente): ${paresInter}`);
console.log(`Pares envolvendo pelo menos um E: ${paresComE}`);

const eClassSemPar = eSemGrupo.filter((l) => String(l.etapa).toUpperCase() === 'CLASSIFICADO');
console.log(`\nE sem grupo em CLASSIFICADO: ${eClassSemPar.length}`);

// E em outras etapas
const eOutras = eSemGrupo.filter((l) => !['IMPORTADO', 'CLASSIFICADO'].includes(String(l.etapa).toUpperCase()));
console.log(`E sem grupo FORA de IMPORTADO/CLASSIFICADO: ${eOutras.length}`);

// ========== TAREFA B1 ==========
console.log('\n\n# TAREFA B1 — Regras de classificação por letra\n');

const classificados = todos.filter((l) => letraDe(l, contaLetra, idLetra) !== 'N');
const naoId = todos.filter((l) => letraDe(l, contaLetra, idLetra) === 'N');
console.log(`\nBase: ${classificados.length} classificados, ${naoId.length} em N\n`);

const regrasPropostas = [];

for (const letra of LETRAS) {
  const arr = classificados.filter((l) => letraDe(l, contaLetra, idLetra) === letra);
  if (!arr.length) continue;

  const descFreq = new Map();
  const bancoFreq = new Map();
  const valores = [];
  const tokenCounts = new Map();

  for (const l of arr) {
    const nd = normDesc(l.descricao);
    descFreq.set(nd, (descFreq.get(nd) ?? 0) + 1);
    const b = l.bancoNome ?? `nº${l.numeroBanco}`;
    bancoFreq.set(b, (bancoFreq.get(b) ?? 0) + 1);
    valores.push(Math.abs(Number(l.valor) || 0));
    for (const t of tokens(l.descricao)) {
      tokenCounts.set(t, (tokenCounts.get(t) ?? 0) + 1);
    }
  }

  const topDesc = [...descFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const topBancos = [...bancoFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const kwThreshold = arr.length * 0.8;
  const keywords = [...tokenCounts.entries()]
    .filter(([, c]) => c >= kwThreshold)
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w)
    .slice(0, 12);

  console.log(`\n### Letra ${letra} (n=${arr.length})\n`);
  console.log('**Top 10 descrições:**');
  for (const [d, c] of topDesc) console.log(`- ${d.slice(0, 55)} (${c})`);
  console.log(`\n**Palavras >80%:** ${keywords.length ? keywords.join(', ') : '—'}`);
  console.log(
    `**Valor:** mediana R$ ${percentil(valores, 50).toLocaleString('pt-BR')} | P10 R$ ${percentil(valores, 10).toLocaleString('pt-BR')} | P90 R$ ${percentil(valores, 90).toLocaleString('pt-BR')}`
  );
  console.log('**Bancos:** ' + topBancos.map(([b, c]) => `${b}(${c})`).join(', '));

  // regras candidatas: keyword + banco dominante
  for (const kw of keywords.slice(0, 5)) {
    for (const [banco] of topBancos.slice(0, 2)) {
      let match = 0;
      let acerto = 0;
      for (const l of todos) {
        const nd = normDesc(l.descricao);
        const b = l.bancoNome ?? '';
        if (!nd.includes(kw) || b !== banco) continue;
        match += 1;
        if (letraDe(l, contaLetra, idLetra) === letra) acerto += 1;
      }
      if (match < 20) continue;
      const conf = (100 * acerto) / match;
      if (conf >= 70) {
        regrasPropostas.push({ letra, kw, banco, match, conf, impactoN: 0 });
      }
    }
  }
}

// impacto em N
for (const r of regrasPropostas) {
  let hitN = 0;
  for (const l of naoId) {
    const nd = normDesc(l.descricao);
    const b = l.bancoNome ?? '';
    if (nd.includes(r.kw) && b === r.banco) hitN += 1;
  }
  r.impactoN = hitN;
}

regrasPropostas.sort((a, b) => b.impactoN - a.impactoN || b.conf - a.conf);

console.log('\n\n## Regras propostas (confiança ≥70%, ordenadas por impacto em N)\n');
console.log('| regra | confiança | match histórico | reclassificaria N |');
console.log('|-------|----------:|----------------:|------------------:|');
for (const r of regrasPropostas.slice(0, 25)) {
  console.log(
    `| se "${r.kw}" + ${r.banco} → ${r.letra} | ${r.conf.toFixed(1)}% | ${r.match} | ${r.impactoN} |`
  );
}

// ========== TAREFA B2 ==========
console.log('\n\n# TAREFA B2 — Transações recorrentes\n');

function addBusinessDaysApprox(d, days) {
  const x = new Date(d);
  let r = Math.abs(days);
  const dir = days >= 0 ? 1 : -1;
  while (r > 0) {
    x.setDate(x.getDate() + dir);
    if (x.getDay() !== 0 && x.getDay() !== 6) r -= 1;
  }
  return x;
}

function parseDate(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

const series = new Map();
for (const l of classificados) {
  const nd = normDesc(l.descricao).slice(0, 45);
  if (!nd || nd.length < 5) continue;
  const banco = l.bancoNome ?? '?';
  const v = Math.abs(Number(l.valor) || 0);
  const k = `${banco}|${nd}`;
  if (!series.has(k)) series.set(k, []);
  series.get(k).push({
    id: l.id,
    data: l.dataLancamento,
    ym: parseYm(l.dataLancamento),
    valor: v,
    letra: letraDe(l, contaLetra, idLetra),
    natureza: l.natureza,
  });
}

const recorrentes = [];

for (const [k, evts] of series) {
  if (evts.length < 4) continue;
  const byYm = new Map();
  for (const e of evts) {
    if (!byYm.has(e.ym)) byYm.set(e.ym, []);
    byYm.get(e.ym).push(e);
  }
  const meses = [...byYm.keys()].sort();
  if (meses.length < 4) continue;

  const medValor = percentil(
    evts.map((e) => e.valor),
    50
  );
  let mesesOk = 0;
  for (let i = 1; i < meses.length; i++) {
    const prev = byYm.get(meses[i - 1])[0];
    const cur = byYm.get(meses[i])[0];
    const d1 = parseDate(prev.data);
    const d2 = parseDate(cur.data);
    const dayDiff = Math.abs((d2 - d1) / 86400000);
    const valorOk =
      Math.abs(cur.valor - medValor) / (medValor || 1) <= TOL_VALOR_REC ||
      Math.abs(prev.valor - cur.valor) / (prev.valor || 1) <= TOL_VALOR_REC;
    if (dayDiff <= 35 && valorOk) mesesOk += 1;
  }
  if (mesesOk < 3) continue;

  const [banco, desc] = k.split('|');
  const letras = [...new Set(evts.map((e) => e.letra))];
  const cat = /salario|pro.?labore|folha|holerit/i.test(desc)
    ? 'salários/pró-labore'
    : /netflix|spotify|assinatura|mensalidade|plano|amazon prime|google storage/i.test(desc)
      ? 'assinaturas'
      : /pix transf|ted|transfer|entre contas|tbi/i.test(desc)
        ? 'transferências regulares'
        : 'outros recorrentes';

  recorrentes.push({
    banco,
    desc,
    freq: `${meses.length} meses / ${evts.length} lanç.`,
    valorMedio: medValor,
    mesesAtiva: meses.length,
    ultima: meses[meses.length - 1],
    letra: letras.join('/'),
    cat,
    mesesOk,
  });
}

recorrentes.sort((a, b) => b.mesesAtiva - a.mesesAtiva);

for (const cat of ['assinaturas', 'salários/pró-labore', 'transferências regulares', 'outros recorrentes']) {
  const items = recorrentes.filter((r) => r.cat === cat);
  if (!items.length) continue;
  console.log(`\n### ${cat} (${items.length})\n`);
  console.log('| banco | descrição | frequência | valor_médio | meses | última | letra |');
  for (const r of items.slice(0, 15)) {
    console.log(
      `| ${r.banco} | ${r.desc.slice(0, 40)} | ${r.freq} | ${r.valorMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | ${r.mesesAtiva} | ${r.ultima} | ${r.letra} |`
    );
  }
}

console.error('\nFim.');
