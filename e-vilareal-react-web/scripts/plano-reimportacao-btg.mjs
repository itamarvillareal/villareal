#!/usr/bin/env node
/**
 * Plano de reimportação BTG (conta 21) — somente leitura/diagnóstico.
 * Não exclui nem importa nada; lista o que fazer e valida o parser corrigido.
 *
 * Uso:
 *   node scripts/plano-reimportacao-btg.mjs
 *   node scripts/plano-reimportacao-btg.mjs --pdf-dir=/Users/itamar/Downloads
 */
import './lib/load-vilareal-import-env.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { PDFParse } from 'pdf-parse';
import { parseBtgPdfExtratoText, parseValorBtgPdfBr } from '../src/utils/btgPdfExtrato.js';

const PDF_DIR = process.argv.find((a) => a.startsWith('--pdf-dir='))?.slice(10) || '/Users/itamar/Downloads';
const PDF_NOMES = [
  'Extrato (28).pdf',
  'Extrato (27).pdf',
  'Extrato (26).pdf',
  'Extrato (30).pdf',
  'Extrato (31).pdf',
  'Extrato (34).pdf',
  'Extrato (32).pdf',
];

function brToIso(d) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(d).trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}
function cent(v) {
  return Math.round(Number(v) * 100);
}
function normDesc(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}
function chaveSem(iso, valor, desc) {
  return `${iso}|${cent(valor)}|${normDesc(desc).slice(0, 100)}`;
}

async function parsePdfMeta(filePath) {
  const buf = fs.readFileSync(filePath);
  const { text } = await new PDFParse({ data: buf }).getText();
  const periodo = text.match(/(\d{2}\/\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{2}\/\d{4})/i);
  let saldoInicial = null;
  let saldoFinal = null;
  for (const raw of text.split(/\r?\n/)) {
    if (/Saldo\s+Inicial/i.test(raw)) {
      const v = [...raw.matchAll(/-?R?\$\s*[\d.]+\,\d{2}|-?\d[\d.]*,\d{2}/g)].at(-1)?.[0];
      if (v) saldoInicial = parseValorBtgPdfBr(v);
    }
    if (/Saldo\s+Final/i.test(raw)) {
      const v = [...raw.matchAll(/-?R?\$\s*[\d.]+\,\d{2}|-?\d[\d.]*,\d{2}/g)].at(-1)?.[0];
      if (v) saldoFinal = parseValorBtgPdfBr(v);
    }
  }
  const rows = parseBtgPdfExtratoText(text).map((r) => ({
    ...r,
    iso: brToIso(r.data),
  }));
  return {
    path: path.basename(filePath),
    periodo,
    saldoInicial,
    saldoFinal,
    rows,
  };
}

async function login() {
  const baseUrl = process.env.VILAREAL_API_BASE.replace(/\/$/, '');
  const j = await (
    await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        login: process.env.VILAREAL_IMPORT_LOGIN.trim().toLowerCase(),
        senha: process.env.VILAREAL_IMPORT_SENHA,
      }),
    })
  ).json();
  return { token: j.accessToken, baseUrl };
}

async function carregarDb(token, baseUrl, ini, fim) {
  const h = { Authorization: `Bearer ${token}` };
  const out = [];
  for (let page = 0; page < 50; page++) {
    const qs = new URLSearchParams({
      numeroBanco: '21',
      dataInicio: ini,
      dataFim: fim,
      page: String(page),
      size: '500',
      sort: 'dataLancamento,asc',
    });
    const j = await (await fetch(`${baseUrl}/api/financeiro/lancamentos/paginada?${qs}`, { headers: h })).json();
    for (const l of j.content ?? []) {
      const iso = String(l.dataLancamento).slice(0, 10);
      const valor = String(l.natureza).toUpperCase() === 'CREDITO' ? Number(l.valor) : -Number(l.valor);
      out.push({
        id: l.id,
        iso,
        valor,
        numero: l.numeroLancamento,
        descricao: l.descricao,
        sem: chaveSem(iso, valor, l.descricao),
      });
    }
    if (page + 1 >= (j.totalPages || 1)) break;
  }
  return out;
}

async function saldoApi(token, baseUrl, data) {
  const h = { Authorization: `Bearer ${token}` };
  const j = await (
    await fetch(
      `${baseUrl}/api/financeiro/lancamentos/saldo-banco?${new URLSearchParams({ numeroBanco: '21', data })}`,
      { headers: h },
    )
  ).json();
  return Number(j.saldo);
}

// --- main ---
const pdfs = [];
for (const nome of PDF_NOMES) {
  const p = path.join(PDF_DIR, nome);
  if (fs.existsSync(p)) pdfs.push(await parsePdfMeta(p));
}

const pdfMaster = new Map();
for (const pdf of pdfs) {
  for (const r of pdf.rows) {
    if (!r.iso) continue;
    pdfMaster.set(chaveSem(r.iso, r.valor, r.descricao), r);
  }
}
/** Todas as linhas (com repetições — extrato BTG repete linhas idênticas). */
const pdfRowsAll = pdfs.flatMap((p) => p.rows.filter((r) => r.iso));
const pdfRows = [...pdfMaster.values()];
const isoMin = pdfRowsAll.map((r) => r.iso).sort()[0];
const isoMax = pdfRowsAll.map((r) => r.iso).sort().at(-1);

const { token, baseUrl } = await login();
const db = await carregarDb(token, baseUrl, isoMin, isoMax);

const pdfSem = new Map();
for (const r of pdfRows) pdfSem.set(r.sem, r);
const dbSem = new Map();
for (const d of db) {
  if (!dbSem.has(d.sem)) dbSem.set(d.sem, d);
}

const sobram = [];
for (const d of db) {
  if (!pdfSem.has(d.sem)) sobram.push(d);
}
const faltam = [];
for (const r of pdfRows) {
  if (!dbSem.has(r.sem)) faltam.push(r);
}

// Valor divergente: mesma data + descrição similar
const dbByDayDesc = new Map();
for (const d of db) {
  const kd = `${d.iso}|${normDesc(d.descricao).slice(0, 60)}`;
  if (!dbByDayDesc.has(kd)) dbByDayDesc.set(kd, []);
  dbByDayDesc.get(kd).push(d);
}
const pdfByDayDesc = new Map();
for (const r of pdfRowsAll) {
  const kd = `${r.iso}|${normDesc(r.descricao).slice(0, 60)}`;
  if (!pdfByDayDesc.has(kd)) pdfByDayDesc.set(kd, []);
  pdfByDayDesc.get(kd).push(r);
}
const valorDiv = [];
for (const [kd, plist] of pdfByDayDesc) {
  const dlist = dbByDayDesc.get(kd);
  if (!dlist?.length || !plist?.length) continue;
  const pdfVals = plist.map((p) => cent(p.valor)).sort((a, b) => a - b).join(',');
  const dbVals = dlist.map((d) => cent(d.valor)).sort((a, b) => a - b).join(',');
  if (pdfVals !== dbVals) {
    valorDiv.push({ kd, plist, dlist });
  }
}

const rendimentoDb = db.filter((d) => /rendimento dispon/i.test(d.descricao || ''));
const tedDup = db.filter(
  (d) =>
    d.iso === '2024-02-26' &&
    Math.abs(d.valor + 6248.88) < 0.01 &&
    /ted enviada/i.test(d.descricao || ''),
);

console.log('═══════════════════════════════════════════════════════════════');
console.log(' PLANO DE REIMPORTAÇÃO — BTG conta 21 (somente diagnóstico)');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('## 1. Correção aplicada no parser');
console.log('   btgPdfExtrato.js agora ignora "Rendimento Disponível - Saldo Remunerado".');
const rendPdf = pdfs.flatMap((p) => p.rows).filter((r) => /rendimento dispon/i.test(r.descricao || ''));
console.log(`   Linhas Rendimento no PDF (não serão importadas): ${rendPdf.length}`);
for (const r of rendPdf) console.log(`     - ${r.iso} ${r.valor.toFixed(2)}`);

console.log('\n## 2. Saldo atual vs extrato');
const saldoHoje = await saldoApi(token, baseUrl, '2026-07-21');
console.log(`   Saldo API hoje: R$ ${saldoHoje.toFixed(2)}`);
for (const pdf of pdfs) {
  if (!pdf.periodo?.[2]) continue;
  const fimIso = brToIso(pdf.periodo[2]);
  if (!fimIso || pdf.saldoFinal == null) continue;
  const api = await saldoApi(token, baseUrl, fimIso);
  const diff = api - pdf.saldoFinal;
  if (Math.abs(diff) >= 0.005) {
    console.log(`   ${pdf.path} fim ${fimIso}: API R$ ${api.toFixed(2)} vs PDF SF R$ ${pdf.saldoFinal.toFixed(2)} → diff R$ ${diff.toFixed(2)}`);
  }
}

console.log('\n## 3. FASE A — Exclusões necessárias (executar manualmente na UI ou API)');
console.log('   Não são ajustes manuais: são remoção de lançamentos importados erroneamente.\n');

console.log('   ### A.1 Rendimento Disponível (parser corrigido, linha não deveria existir)');
if (rendimentoDb.length) {
  for (const d of rendimentoDb) {
    console.log(`   EXCLUIR id=${d.id} | ${d.iso} | +R$ ${d.valor.toFixed(2)} | ${d.numero}`);
  }
} else {
  console.log('   (nenhum no banco — ok)');
}

console.log('\n   ### A.2 TED duplicada 26/02/2024');
if (tedDup.length >= 2) {
  console.log(`   EXCLUIR id=${tedDup[1].id} (manter id=${tedDup[0].id})`);
  for (const d of tedDup) console.log(`     id=${d.id} ${d.numero}`);
} else if (tedDup.length === 1) {
  console.log('   (apenas 1 TED — ok)');
} else {
  console.log('   (não encontrada — verificar)');
}

console.log(`\n   ### A.3 Valores truncados (${valorDiv.length} pares dia+descrição)`);
console.log('   Excluir os registros do banco (coluna DB) e reimportar do PDF:\n');
const idsTrunc = new Set();
for (const v of valorDiv) {
  // Só ids cujo valor no banco não aparece no PDF (truncamento / corrupção)
  const pdfCentSet = new Set(v.plist.map((p) => cent(p.valor)));
  const dbErrados = v.dlist.filter((d) => !pdfCentSet.has(cent(d.valor)));
  if (!dbErrados.length) continue;
  console.log(`   ${v.kd.split('|')[0]} | ${v.kd.split('|')[1]?.slice(0, 45)}`);
  const pdfUnicos = [...new Set(v.plist.map((p) => cent(p.valor)))].sort((a, b) => a - b);
  for (const c of pdfUnicos) console.log(`     PDF  R$ ${(c / 100).toFixed(2)}`);
  for (const d of dbErrados) {
    idsTrunc.add(d.id);
    console.log(`     DB   R$ ${d.valor.toFixed(2)} → EXCLUIR id=${d.id}`);
  }
  console.log('');
}

const idsExcluir = new Set([
  ...rendimentoDb.map((d) => d.id),
  ...(tedDup.length >= 2 ? [tedDup[1].id] : []),
  ...idsTrunc,
]);

console.log('\n   Resumo exclusões:');
console.log(`   - Rendimento: ${rendimentoDb.length}`);
console.log(`   - TED dup: ${tedDup.length >= 2 ? 1 : 0}`);
console.log(`   - Truncados: ${idsTrunc.size}`);
console.log(`   - TOTAL ids a excluir: ${idsExcluir.size}`);

console.log('\n## 4. FASE B — Reimportação (após exclusões)');
console.log('   Ordem sugerida (períodos cobertos, sem sobrepor desnecessariamente):\n');
const ordem = [
  ['Extrato (28).pdf', 'mar–jun/2023 — validar que Rendimento não entra'],
  ['Extrato (27).pdf', 'jun–dez/2023'],
  ['Extrato (30).pdf', 'dez/2023–fev/2024 — corrige truncados jan/fev'],
  ['Extrato (34).pdf', 'set/2023–mai/2024 — cobertura longa (alternativa ao 30+32)'],
  ['Extrato (32).pdf', 'mar–mai/2024 — se usar 34, pode pular'],
];
for (const [nome, desc] of ordem) {
  const existe = fs.existsSync(path.join(PDF_DIR, nome));
  console.log(`   ${existe ? '✓' : '✗'} node scripts/import-extrato-btg-pdf.mjs "${path.join(PDF_DIR, nome)}" --dry-run`);
  console.log(`     ${desc}`);
}

console.log('\n   Comandos (dry-run primeiro, depois sem --dry-run):');
for (const nome of ['Extrato (30).pdf', 'Extrato (34).pdf']) {
  const p = path.join(PDF_DIR, nome);
  if (fs.existsSync(p)) {
    console.log(`\n   # Validar parser + contagem novos:`);
    console.log(`   node scripts/import-extrato-btg-pdf.mjs "${p}" --dry-run`);
  }
}

console.log('\n## 5. FASE C — Validação pós-reimportação');
console.log('   node scripts/tmp/conciliar-btg-por-pdf.mjs');
console.log('   Conferir saldos nas fronteiras:');
for (const [iso, label] of [
  ['2023-06-30', 'Extrato 28'],
  ['2023-09-28', 'Extrato 31'],
  ['2024-02-29', 'Extrato 30'],
  ['2024-05-29', 'Extrato 32'],
]) {
  console.log(`     ${iso} (${label}): API deve = PDF SF`);
}

console.log('\n## 6. Sobras no banco sem par no PDF (revisar)');
const sobramSemTrunc = sobram.filter((d) => !idsExcluir.has(d.id));
console.log(`   ${sobramSemTrunc.length} lançamentos no banco sem match semântico no PDF`);
const petz = sobramSemTrunc.filter((d) => /PETZ3/i.test(d.descricao || ''));
if (petz.length) {
  console.log(`   - ${petz.length} taxas PETZ3 duplicadas (abr/2024) — conferir no PDF se são legítimas`);
}

console.log('\n## 7. PDFs adicionais');
console.log('   Para auditar jun/2024–jul/2026, envie extratos desse intervalo.');
console.log('   Os 9 PDFs atuais bastam para corrigir o resíduo de R$ 0,13 e os truncados de 2024.\n');
