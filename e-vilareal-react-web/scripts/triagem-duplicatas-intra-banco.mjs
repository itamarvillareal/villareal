#!/usr/bin/env node
/** Prompt 20 — Triagem duplicatas intra-banco (somente leitura). */

import './lib/load-vilareal-import-env.mjs';

const base = (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, '');
const senha = process.env.VILAREAL_IMPORT_SENHA || '123456';

const { accessToken } = await fetch(`${base}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ login: 'itamar', senha }),
}).then((r) => r.json());

const headers = { Authorization: `Bearer ${accessToken}` };

async function fetchPage(page, size, retries = 4) {
  const url = `${base}/api/financeiro/lancamentos/paginada?page=${page}&size=${size}&sort=dataLancamento,asc`;
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(url, { headers });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise((res) => setTimeout(res, 1500 * (i + 1)));
    }
  }
}

async function fetchAll() {
  const out = [];
  let page = 0;
  const size = 2000;
  while (true) {
    const data = await fetchPage(page, size);
    out.push(...(data.content ?? []));
    process.stderr.write(`  pág ${page + 1}/${data.totalPages ?? '?'} (${out.length})\n`);
    if (page + 1 >= (data.totalPages ?? 1) || !(data.content?.length)) break;
    page += 1;
  }
  return out;
}

function bancoLabel(l) {
  return l.bancoNome ?? `nº${l.numeroBanco ?? '?'}`;
}

function chaveValor(v) {
  return (Math.round(Math.abs(Number(v)) * 100) / 100).toFixed(2);
}

console.error('Carregando lançamentos…');
const todos = await fetchAll();
console.error(`Total: ${todos.length}`);

const clusters = new Map();
for (const l of todos) {
  const k = `${bancoLabel(l)}|${l.dataLancamento}|${chaveValor(l.valor)}|${String(l.descricao ?? '').trim().toUpperCase()}`;
  if (!clusters.has(k)) clusters.set(k, []);
  clusters.get(k).push(l);
}

const dupClusters = [...clusters.entries()].filter(([, arr]) => arr.length >= 2);

let totalEmClusters = 0;
let totalExcedente = 0;
const porBanco = new Map();

for (const [, arr] of dupClusters) {
  const n = arr.length;
  totalEmClusters += n;
  totalExcedente += n - 1;
  const b = bancoLabel(arr[0]);
  if (!porBanco.has(b)) porBanco.set(b, { clusters: 0, lancamentos: 0, excedente: 0 });
  const pb = porBanco.get(b);
  pb.clusters += 1;
  pb.lancamentos += n;
  pb.excedente += n - 1;
}

/** Indício import duplicado: mesmo banco, mês YYYY-MM, >80% das chaves do mês aparecem 2+ vezes */
function scoreImportDuplicado(banco, ym, clusterKeysNoMes) {
  const noMes = todos.filter((l) => bancoLabel(l) === banco && String(l.dataLancamento).startsWith(ym));
  if (noMes.length < 10) return false;
  const keysMes = new Set(
    noMes.map(
      (l) =>
        `${l.dataLancamento}|${chaveValor(l.valor)}|${String(l.descricao ?? '').trim().toUpperCase()}`
    )
  );
  const dupKeys = new Set(clusterKeysNoMes);
  return dupKeys.size / keysMes.size > 0.15;
}

const ranked = dupClusters
  .map(([k, arr]) => {
    const [banco, data] = k.split('|');
    const valor = Math.abs(Number(arr[0].valor));
    const excedente = arr.length - 1;
    const ym = String(data).slice(0, 7);
    return {
      banco,
      data,
      ym,
      valor,
      descricao: (arr[0].descricao ?? '').slice(0, 55),
      qtd: arr.length,
      excedente,
      score: valor * excedente,
      ids: arr.map((l) => l.id).join(','),
    };
  })
  .sort((a, b) => b.score - a.score);

const importSuspeito = new Map();
for (const c of ranked) {
  const key = `${c.banco}|${c.ym}`;
  if (!importSuspeito.has(key)) {
    const keysMes = dupClusters
      .filter(([k]) => k.startsWith(`${c.banco}|${c.ym}`))
      .map(([k]) => k);
    importSuspeito.set(key, scoreImportDuplicado(c.banco, c.ym, keysMes));
  }
  c.importSuspeito = importSuspeito.get(key);
}

console.log('\n# PROMPT 20 — Triagem duplicatas intra-banco\n');
console.log('## Resumo\n');
console.log(`| Métrica | Valor |`);
console.log(`|---------|------:|`);
console.log(`| Clusters duplicados (≥2 iguais) | ${dupClusters.length} |`);
console.log(`| Lançamentos dentro de clusters | ${totalEmClusters} |`);
console.log(`| Lançamentos excedentes (removíveis se import dup) | ${totalExcedente} |`);

console.log('\n## Distribuição por banco\n');
console.log('| banco | clusters | lançamentos em clusters | excedentes |');
console.log('|-------|----------|------------------------:|-----------:|');
const bancosOrd = [...porBanco.entries()].sort((a, b) => b[1].excedente - a[1].excedente);
for (const [b, s] of bancosOrd) {
  console.log(`| ${b} | ${s.clusters} | ${s.lancamentos} | ${s.excedente} |`);
}

console.log('\n## Top 15 clusters (valor × excedente)\n');
console.log('| banco | data | qtd | valor (R$) | descrição | import_dup? | ids |');
console.log('|-------|------|----:|-----------:|-----------|:-----------:|-----|');
for (const c of ranked.slice(0, 15)) {
  const imp = c.importSuspeito ? 'SIM' : 'não';
  console.log(
    `| ${c.banco} | ${c.data} | ${c.qtd} | ${c.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | ${c.descricao} | ${imp} | ${c.ids.slice(0, 40)}… |`
  );
}

const mesesImport = [...importSuspeito.entries()].filter(([, v]) => v);
console.log(`\n## Meses com indício de import duplicado (>15% chaves do mês em cluster): ${mesesImport.length}\n`);
console.log('| banco | mês |');
console.log('|-------|-----|');
for (const [k] of mesesImport.sort().slice(0, 25)) {
  const [b, ym] = k.split('|');
  console.log(`| ${b} | ${ym} |`);
}
if (mesesImport.length > 25) console.log(`| … | +${mesesImport.length - 25} meses |`);

console.error('\nConcluído.');
