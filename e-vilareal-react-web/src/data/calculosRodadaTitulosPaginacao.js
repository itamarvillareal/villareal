/** Utilitários para merge de páginas de títulos (GET paginado) no estado completo da rodada. */

import { formatBRL } from '../components/calculos/calculosTitulosGridUtils.js';
import { parseBRLToCentavos } from '../utils/moneyBr.js';
import { linhaTituloVaziaCalculos } from './calculosTitulosParcelasSync.js';

/** Soma campos monetários pt-BR em centavos inteiros (evita 16,869999… → 16,86). */
function somaCentavosBRL(...campos) {
  return campos.reduce((acc, campo) => {
    const c = parseBRLToCentavos(campo);
    return acc + (c ?? 0);
  }, 0);
}

function formatBRLCentavos(centavos) {
  return formatBRL(centavos / 100);
}

export const TITULOS_POR_PAGINA_API = 20;

/** @param {unknown} raw */
export function linhaTituloVaziaFromApi(raw) {
  const base = linhaTituloVaziaCalculos();
  if (!raw || typeof raw !== 'object') return base;
  return { ...base, ...raw };
}

/**
 * Garante array de tamanho {@code total} (linhas vazias onde ainda não houve GET da página).
 * @param {unknown[]} titulosAtual
 * @param {number} total
 */
export function garantirArrayTitulosTamanho(titulosAtual, total) {
  const n = Math.max(0, Math.floor(Number(total) || 0));
  const arr = Array.isArray(titulosAtual) ? [...titulosAtual] : [];
  while (arr.length < n) {
    arr.push(linhaTituloVaziaCalculos());
  }
  if (arr.length > n) {
    return arr.slice(0, n);
  }
  return arr;
}

/**
 * Mescla títulos de uma página no índice global correto.
 * @param {unknown[]} titulosBase
 * @param {unknown[]} titulosPagina
 * @param {number} page 1-based
 * @param {number} [limit=20]
 */
export function mesclarTitulosPaginaNoArray(titulosBase, titulosPagina, page, limit = TITULOS_POR_PAGINA_API) {
  const pg = Math.max(1, Math.floor(Number(page) || 1));
  const lim = Math.max(1, Math.floor(Number(limit) || TITULOS_POR_PAGINA_API));
  const start = (pg - 1) * lim;
  const arr = Array.isArray(titulosBase) ? [...titulosBase] : [];
  const slice = Array.isArray(titulosPagina) ? titulosPagina : [];
  for (let i = 0; i < slice.length; i++) {
    const idx = start + i;
    while (arr.length <= idx) {
      arr.push(linhaTituloVaziaCalculos());
    }
    arr[idx] = linhaTituloVaziaFromApi(slice[i]);
  }
  return arr;
}

/**
 * Soma colunas da grade de títulos (paridade Excel Somar_Taxas / {@code Calculos.jsx}).
 * Considera apenas linhas com {@code valorInicial} preenchido.
 * @param {Array<Record<string, unknown>> | undefined} lista
 */
export function calcularTotalLinhaTitulo(row) {
  const base = row && typeof row === 'object' ? { ...row } : linhaTituloVaziaCalculos();
  const principalStr = String(base.valorInicial ?? '').trim();
  if (principalStr === '') {
    return { ...base, total: '' };
  }
  const totalCentavos = somaCentavosBRL(
    base.valorInicial,
    base.atualizacaoMonetaria,
    base.juros,
    base.multa,
    base.honorarios
  );
  return { ...base, total: formatBRLCentavos(totalCentavos) };
}

/**
 * Soma colunas da grade de títulos (paridade Excel Somar_Taxas / {@code Calculos.jsx}).
 * Considera apenas linhas com {@code valorInicial} preenchido.
 * @param {Array<Record<string, unknown>> | undefined} lista
 */
export function calcularResumoTitulosGrade(lista) {
  const valid = (lista || []).filter((r) => String(r?.valorInicial ?? '').trim() !== '');
  const qtd = valid.length;

  let cValorInicial = 0;
  let cAtualizacao = 0;
  let cJuros = 0;
  let cMulta = 0;
  let cHonorarios = 0;
  for (const r of valid) {
    cValorInicial += parseBRLToCentavos(r.valorInicial) ?? 0;
    cAtualizacao += parseBRLToCentavos(r.atualizacaoMonetaria) ?? 0;
    cJuros += parseBRLToCentavos(r.juros) ?? 0;
    cMulta += parseBRLToCentavos(r.multa) ?? 0;
    cHonorarios += parseBRLToCentavos(r.honorarios) ?? 0;
  }
  const cTotal = cValorInicial + cAtualizacao + cJuros + cMulta + cHonorarios;

  const diasNums = valid
    .map((r) => Number(String(r?.diasAtraso ?? '').trim()))
    .filter((n) => Number.isFinite(n));
  const sumDias = diasNums.reduce((a, b) => a + b, 0);

  const qtdLabel = `${String(qtd).padStart(2, '0')} título${qtd === 1 ? '' : 's'}`;

  return {
    qtd: qtdLabel,
    valorInicial: formatBRLCentavos(cValorInicial),
    atualizacao: formatBRLCentavos(cAtualizacao),
    diasAtraso: `${Math.floor(sumDias)} dias de atraso`,
    juros: formatBRLCentavos(cJuros),
    multa: formatBRLCentavos(cMulta),
    honorarios: formatBRLCentavos(cHonorarios),
    total: formatBRLCentavos(cTotal),
  };
}

/**
 * Monta array com todos os slots da dimensão, mesclando estado local e páginas em cache da API.
 * @param {unknown[]} titulosAtual
 * @param {number | null | undefined} totalEsperado
 * @param {Iterable<[string, { titulos?: unknown[] } | undefined]> | null | undefined} paginasCache
 * @param {string} rodadaKey
 */
export function montarTitulosDimensaoParaResumo(titulosAtual, totalEsperado, paginasCache, rodadaKey) {
  const arrAtual = Array.isArray(titulosAtual) ? titulosAtual : [];
  const totalFromState = arrAtual.length;
  const totalFromMeta =
    totalEsperado != null && Number(totalEsperado) > 0
      ? Math.floor(Number(totalEsperado))
      : 0;

  const prefix = `${rodadaKey}:page:`;
  let totalFromCache = 0;
  let base = [];

  if (paginasCache) {
    for (const [key, cached] of paginasCache) {
      if (!String(key).startsWith(prefix) || !cached?.titulos) continue;
      const pg = Number(String(key).slice(prefix.length));
      if (!Number.isFinite(pg) || pg < 1) continue;
      const start = (pg - 1) * TITULOS_POR_PAGINA_API;
      totalFromCache = Math.max(totalFromCache, start + cached.titulos.length);
      base = mesclarTitulosPaginaNoArray(base, cached.titulos, pg, TITULOS_POR_PAGINA_API);
    }
  }

  // Não truncar linhas novas digitadas localmente além do total persistido na API.
  const total = Math.max(totalFromMeta, totalFromState, totalFromCache);
  base = garantirArrayTitulosTamanho(base, total);

  // Estado local prevalece sobre páginas em cache (edições da sessão).
  for (let i = 0; i < arrAtual.length; i++) {
    while (base.length <= i) {
      base.push(linhaTituloVaziaCalculos());
    }
    base[i] = linhaTituloVaziaFromApi(arrAtual[i]);
  }

  return base;
}

/** Linhas com {@code valorInicial} preenchido (usado para saber se a dimensão está totalmente carregada). */
export function contarTitulosComValorInicial(lista) {
  return (lista || []).filter((r) => String(r?.valorInicial ?? '').trim() !== '').length;
}

/**
 * Converte {@code titulosResumo} da API para o formato de {@code calcularResumoTitulosGrade} na UI.
 * @param {Record<string, unknown> | null | undefined} apiResumo
 */
export function resumoTitulosFromApi(apiResumo) {
  if (!apiResumo || typeof apiResumo !== 'object') return null;
  const qtd = Number(apiResumo.quantidadeTitulos) || 0;
  const fmt = (n) => {
    const v = Number(n) || 0;
    return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  return {
    qtd: `${String(qtd).padStart(2, '0')} título${qtd === 1 ? '' : 's'}`,
    valorInicial: fmt(apiResumo.totalValorInicial),
    atualizacao: fmt(apiResumo.totalAtualizacao),
    diasAtraso: `${Math.floor(Number(apiResumo.totalDiasAtraso) || 0)} dias de atraso`,
    juros: fmt(apiResumo.totalJuros),
    multa: fmt(apiResumo.totalMulta),
    honorarios: fmt(apiResumo.totalHonorarios),
    total: fmt(apiResumo.totalGeral),
  };
}

/**
 * Resumo geral da grade: soma local quando todos os títulos estão materializados;
 * enquanto a paginação da API ainda não trouxe todas as páginas, usa {@code titulosResumo} da API.
 * @param {Array<Record<string, unknown>> | undefined} titulosDimensao
 * @param {number | null | undefined} totalEsperado
 * @param {Record<string, unknown> | null | undefined} titulosResumoApi
 */
export function resolverResumoGeralTitulos(titulosDimensao, totalEsperado, titulosResumoApi) {
  const local = calcularResumoTitulosGrade(titulosDimensao);
  const total = totalEsperado != null ? Number(totalEsperado) : NaN;
  if (!Number.isFinite(total) || total <= 0) return local;
  if (contarTitulosComValorInicial(titulosDimensao) >= total) return local;
  return resumoTitulosFromApi(titulosResumoApi) ?? local;
}
