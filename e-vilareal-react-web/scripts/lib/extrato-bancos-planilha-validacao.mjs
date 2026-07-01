/**
 * Validação planilha × API (chave PL-*, contagem e saldo mensal).
 */

import { NUMERO_PARA_BANCO } from './extrato-bancos-planilha-constantes.mjs';
import {
  LAYOUTS_EXTRATO_BANCO,
  extrairLancamentosDaAba,
  layoutExtratoPorNomeInstituicao,
} from './extrato-bancos-planilha-layouts.mjs';

const BATCH_NUMEROS = 500;
const PAGE_SIZE = 500;

export function numeroBancoPorNomeInstituicao(nome) {
  const entry = Object.entries(NUMERO_PARA_BANCO).find(([, n]) => n === nome);
  return entry ? Number(entry[0]) : null;
}

export function saldoSigned(valor, natureza) {
  const v = Number(valor) || 0;
  return natureza === 'DEBITO' ? -v : v;
}

function fmtSaldo(n) {
  return (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function filtrarLinhasPlanilha(linhas, opts) {
  let out = linhas;
  if (opts?.data) out = out.filter((r) => r.dataIso === opts.data);
  else if (opts?.mes) out = out.filter((r) => r.dataIso.startsWith(`${opts.mes}-`));
  else if (opts?.desde) out = out.filter((r) => r.dataIso >= opts.desde);
  if (opts?.limite != null) out = out.slice(0, opts.limite);
  return out;
}

export function extrairLinhasPlanilhaBanco(wb, bancoNome, opts = {}) {
  const layout = opts.layout
    ? LAYOUTS_EXTRATO_BANCO[opts.layout] ?? layoutExtratoPorNomeInstituicao(bancoNome)
    : layoutExtratoPorNomeInstituicao(bancoNome);
  const ws = wb.Sheets[bancoNome];
  if (!ws) return { layout, linhas: [] };
  const linhas = filtrarLinhasPlanilha(extrairLancamentosDaAba(ws, layout, bancoNome), opts);
  return { layout, linhas };
}

function agregarPorMes(rows, getMes, getSaldo) {
  const map = new Map();
  for (const r of rows) {
    const mes = getMes(r);
    if (!mes) continue;
    const agg = map.get(mes) ?? { mes, qtd: 0, saldo: 0 };
    agg.qtd += 1;
    agg.saldo += getSaldo(r);
    map.set(mes, agg);
  }
  return map;
}

export function agregarPlanilhaPorMes(linhas) {
  return agregarPorMes(
    linhas,
    (r) => r.dataIso?.slice(0, 7),
    (r) => Number(r.valor) || 0,
  );
}

export function agregarDbPorMes(lancamentos) {
  return agregarPorMes(
    lancamentos,
    (r) => String(r.dataLancamento ?? '').slice(0, 7),
    (r) => saldoSigned(r.valor, r.natureza),
  );
}

export function compararMeses(planPorMes, dbPorMes) {
  const meses = [...new Set([...planPorMes.keys(), ...dbPorMes.keys()])].sort();
  const gaps = [];
  for (const mes of meses) {
    const p = planPorMes.get(mes) ?? { qtd: 0, saldo: 0 };
    const d = dbPorMes.get(mes) ?? { qtd: 0, saldo: 0 };
    if (p.qtd !== d.qtd || Math.round(p.saldo * 100) !== Math.round(d.saldo * 100)) {
      gaps.push({
        mes,
        planQtd: p.qtd,
        dbQtd: d.qtd,
        planSaldo: p.saldo,
        dbSaldo: d.saldo,
      });
    }
  }
  return gaps;
}

/**
 * @param {string} token
 * @param {string} baseUrl
 * @param {number} numeroBanco
 * @param {string[]} numeros
 */
export async function fetchNumerosExistentes(token, baseUrl, numeroBanco, numeros) {
  const existentes = new Set();
  for (let i = 0; i < numeros.length; i += BATCH_NUMEROS) {
    const batch = numeros.slice(i, i + BATCH_NUMEROS);
    const res = await fetch(`${baseUrl}/api/financeiro/extrato/importacao/numeros-existentes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ numeroBanco, numeros: batch }),
    });
    if (!res.ok) {
      throw new Error(`numeros-existentes ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const j = await res.json();
    for (const n of j.existentes ?? []) existentes.add(n);
  }
  return existentes;
}

/**
 * @param {string} token
 * @param {string} baseUrl
 * @param {number} numeroBanco
 */
export async function fetchTodosLancamentosBanco(token, baseUrl, numeroBanco) {
  const out = [];
  let page = 0;
  while (true) {
    const params = new URLSearchParams({
      numeroBanco: String(numeroBanco),
      size: String(PAGE_SIZE),
      page: String(page),
      sort: 'dataLancamento,asc',
    });
    const res = await fetch(`${baseUrl}/api/financeiro/lancamentos/paginada?${params}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`lancamentos/paginada ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const j = await res.json();
    const content = j.content ?? [];
    out.push(...content);
    if (j.last === true || content.length === 0) break;
    page += 1;
  }
  return out;
}

/**
 * @param {object} params
 * @param {string} params.token
 * @param {string} params.baseUrl
 * @param {import('xlsx').WorkBook} params.wb
 * @param {string} params.bancoNome
 * @param {object} [params.opts]
 */
export async function validarExtratoPlanilhaVsApi({ token, baseUrl, wb, bancoNome, opts = {} }) {
  const numeroBanco = numeroBancoPorNomeInstituicao(bancoNome);
  if (numeroBanco == null) {
    throw new Error(`Número do banco desconhecido: ${bancoNome}`);
  }

  const { linhas: planLinhas } = extrairLinhasPlanilhaBanco(wb, bancoNome, opts);
  const numeros = planLinhas.map((r) => r.numeroLancamento);
  const existentes = await fetchNumerosExistentes(token, baseUrl, numeroBanco, numeros);
  const faltantes = planLinhas.filter((r) => !existentes.has(r.numeroLancamento));
  const dbRows = await fetchTodosLancamentosBanco(token, baseUrl, numeroBanco);

  const planPorMes = agregarPlanilhaPorMes(planLinhas);
  const dbPorMes = agregarDbPorMes(dbRows);
  const gaps = compararMeses(planPorMes, dbPorMes);

  const saldoPlan = planLinhas.reduce((s, r) => s + (Number(r.valor) || 0), 0);
  const saldoDb = dbRows.reduce((s, r) => s + saldoSigned(r.valor, r.natureza), 0);
  const saldoFalt = faltantes.reduce((s, r) => s + (Number(r.valor) || 0), 0);

  return {
    numeroBanco,
    planLinhas,
    existentes,
    faltantes,
    dbRows,
    gaps,
    saldoPlan,
    saldoDb,
    saldoFalt,
  };
}

/**
 * @param {Awaited<ReturnType<typeof validarExtratoPlanilhaVsApi>>} r
 * @param {string} label
 */
export function imprimirRelatorioValidacao(r, label) {
  console.log(`\n=== Validação ${label} ===`);
  console.log(`Planilha:  ${r.planLinhas.length.toLocaleString('pt-BR')} lanç.  saldo ${fmtSaldo(r.saldoPlan)}`);
  console.log(`Banco API: ${r.dbRows.length.toLocaleString('pt-BR')} lanç.  saldo ${fmtSaldo(r.saldoDb)}`);
  console.log(
    `Faltantes: ${r.faltantes.length.toLocaleString('pt-BR')} (PL-*)  saldo ${fmtSaldo(r.saldoFalt)}`,
  );
  const diffSaldo = Math.round((r.saldoPlan - r.saldoDb) * 100) / 100;
  const diffFalt = Math.round(r.saldoFalt * 100) / 100;
  console.log(
    `Δ plan−banco: ${fmtSaldo(diffSaldo)}  (= faltantes: ${Math.abs(diffSaldo - diffFalt) < 0.01 ? 'sim ✓' : 'não ⚠'})`,
  );
  console.log(`Meses com gap (qtd ou saldo): ${r.gaps.length}`);
  const maxLinhas = 22;
  for (const g of r.gaps.slice(0, maxLinhas)) {
    console.log(
      `  ${g.mes}: plan ${g.planQtd}/${fmtSaldo(g.planSaldo)}  db ${g.dbQtd}/${fmtSaldo(g.dbSaldo)}`,
    );
  }
  if (r.gaps.length > maxLinhas) {
    console.log(`  … +${r.gaps.length - maxLinhas} meses`);
  }
}
