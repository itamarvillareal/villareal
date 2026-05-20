/** Utilitários para merge de páginas de títulos (GET paginado) no estado completo da rodada. */

import { linhaTituloVaziaCalculos } from './calculosTitulosParcelasSync.js';

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
 * Converte {@code titulosResumo} da API para o formato de {@code calcularResumo} na UI.
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
