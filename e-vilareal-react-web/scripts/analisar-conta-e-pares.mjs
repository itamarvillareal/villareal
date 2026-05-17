#!/usr/bin/env node
/** Análise de pares cross-banco para lançamentos conta E (id 6), janela ±3 dias úteis. */

import './lib/load-vilareal-import-env.mjs';

const base = (process.env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, '');
const senha = process.env.VILAREAL_IMPORT_SENHA || '123456';
const CONTA_E_ID = 6;
const TOL_VALOR = 0.02;
const JANELA_DU = 3;

const { accessToken } = await fetch(`${base}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ login: 'itamar', senha }),
}).then((r) => r.json());

const headers = { Authorization: `Bearer ${accessToken}` };

const [lancsE, todos] = await Promise.all([
  fetch(`${base}/api/financeiro/lancamentos?contaContabilId=${CONTA_E_ID}`, { headers }).then((r) =>
    r.json()
  ),
  fetch(`${base}/api/financeiro/lancamentos`, { headers }).then((r) => r.json()),
]);

function parseDate(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isWeekend(d) {
  const w = d.getDay();
  return w === 0 || w === 6;
}

/** Diferença em dias úteis entre duas datas (>= 0). */
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

function dentroJanelaDU(dataA, dataB) {
  return diasUteisEntre(parseDate(dataA), parseDate(dataB)) <= JANELA_DU;
}

/** Índice por valor absoluto → candidatos não-E ou todos exceto mesmo banco */
const porValor = new Map();
for (const l of todos) {
  const k = chaveValor(Number(l.valor));
  if (!porValor.has(k)) porValor.set(k, []);
  porValor.get(k).push(l);
}

/** Grupos E com membros cross-banco e soma ~0 */
const membrosGrupo = new Map();
for (const l of lancsE) {
  const g = String(l.grupoCompensacao ?? '').trim();
  if (!g) continue;
  if (!membrosGrupo.has(g)) membrosGrupo.set(g, []);
  membrosGrupo.get(g).push(l);
}

function pareadoViaGrupo(l) {
  const g = String(l.grupoCompensacao ?? '').trim();
  if (!g) return false;
  const membros = membrosGrupo.get(g) ?? [];
  if (membros.length < 2) return false;
  const bancos = new Set(membros.map((m) => m.numeroBanco ?? m.bancoNome));
  if (bancos.size < 2) return false;
  const soma = membros.reduce((s, m) => s + valorAssinado(m), 0);
  return Math.abs(soma) <= TOL_VALOR;
}

const resultados = [];
let pareadosConfianca = 0;
let semPar = 0;
let ambiguos = 0;

for (const e of lancsE) {
  if (pareadoViaGrupo(e)) {
    pareadosConfianca += 1;
    resultados.push({ e, status: 'GRUPO_OK' });
    continue;
  }

  const k = chaveValor(Number(e.valor));
  const pool = porValor.get(k) ?? [];
  const candidatos = pool.filter(
    (c) =>
      c.id !== e.id &&
      !mesmoBanco(e, c) &&
      valoresOpostos(e, c) &&
      dentroJanelaDU(e.dataLancamento, c.dataLancamento)
  );

  if (candidatos.length === 1) {
    pareadosConfianca += 1;
    resultados.push({ e, status: 'PAR_UNICO', par: candidatos[0] });
  } else if (candidatos.length === 0) {
    semPar += 1;
    resultados.push({ e, status: 'ORFAO', candidatos: [] });
  } else {
    ambiguos += 1;
    resultados.push({ e, status: 'AMBIGUO', candidatos });
  }
}

const orfaos = resultados
  .filter((r) => r.status === 'ORFAO')
  .map((r) => ({
    id: r.e.id,
    banco: r.e.bancoNome ?? r.e.numeroBanco,
    data: r.e.dataLancamento,
    valor: Number(r.e.valor),
    valorAbs: Math.abs(Number(r.e.valor)),
    natureza: r.e.natureza,
    descricao: (r.e.descricao ?? '').slice(0, 80),
    grupo: r.e.grupoCompensacao,
  }))
  .sort((a, b) => b.valorAbs - a.valorAbs);

const saldoPorMes = new Map();
for (const e of lancsE) {
  const ym = String(e.dataLancamento).slice(0, 7);
  saldoPorMes.set(ym, (saldoPorMes.get(ym) ?? 0) + valorAssinado(e));
}

const total = lancsE.length;
const pct = (n) => (total ? ((100 * n) / total).toFixed(1) : '0.0');

console.log('\n=== ANÁLISE CONTA E (compensação) ===\n');
console.log(`Total de lançamentos E: ${total}`);
console.log(`Pareados com confiança: ${pareadosConfianca} (${pct(pareadosConfianca)}%)`);
console.log(`  — via grupo cross-banco OK: ${resultados.filter((r) => r.status === 'GRUPO_OK').length}`);
console.log(`  — par único valor/data/janela: ${resultados.filter((r) => r.status === 'PAR_UNICO').length}`);
console.log(`Sem par (órfãos): ${semPar} (${pct(semPar)}%)`);
console.log(`Múltiplos pares possíveis (ambíguos): ${ambiguos} (${pct(ambiguos)}%)`);

console.log('\n--- Top 10 órfãos por valor absoluto ---');
for (const o of orfaos.slice(0, 10)) {
  console.log(
    `  ${o.banco} | ${o.data} | ${o.natureza} R$ ${o.valorAbs.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | ${o.descricao}${o.grupo ? ` [grupo ${o.grupo}]` : ''}`
  );
}

console.log('\n--- Saldo líquido E por mês/ano ---');
console.log('| Mês/ano   | Saldo líquido (R$) |');
console.log('|-----------|-------------------:|');
const meses = [...saldoPorMes.keys()].sort();
for (const ym of meses) {
  const s = saldoPorMes.get(ym);
  console.log(`| ${ym}    | ${s.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(17)} |`);
}

const saldoTotal = meses.reduce((acc, ym) => acc + saldoPorMes.get(ym), 0);
console.log(`\nSaldo acumulado (todos os meses): R$ ${saldoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
