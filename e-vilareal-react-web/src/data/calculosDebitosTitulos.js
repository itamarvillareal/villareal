/**
 * Converte débitos/taxas (legado txt 100–108) para a grade de Títulos da UI (como Excel).
 */

import { parseValorMonetarioBr } from '../utils/parseValorMonetarioBr.js';
import { linhaTituloVaziaCalculos } from './calculosTitulosParcelasSync.js';

function trunc2(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.trunc(v * 100) / 100;
}

/** Soma monetária em centavos (evita 57,989999 → 57,98 em vez de 57,99). */
function somaMonetariaTrunc2(...valores) {
  const centavos = valores.reduce((acc, v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return acc;
    return acc + Math.round(n * 100);
  }, 0);
  return trunc2(centavos / 100);
}

/** @param {number} n */
export function formatBRLTitulo(n) {
  const v = Number(n) || 0;
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Normaliza valor vindo do txt (com ou sem «R$») para exibição na grade. */
export function formatCampoMonetarioTxt(val) {
  if (val == null || String(val).trim() === '') return '';
  const s = String(val).trim();
  if (/^R\$\s*/i.test(s)) return s;
  const n = parseValorMonetarioBr(s);
  if (n == null) return s;
  return formatBRLTitulo(n);
}

/**
 * Total da linha (VBA Somar_Taxas): principal + encargos (crédito negativo permanece negativo no total).
 * @param {{ valorInicial?: string, atualizacaoMonetaria?: string, juros?: string, multa?: string, honorarios?: string }} t
 */
export function calcularTotalTituloGrade(t) {
  const vi = parseValorMonetarioBr(t.valorInicial) ?? 0;
  const am = parseValorMonetarioBr(t.atualizacaoMonetaria) ?? 0;
  const ju = parseValorMonetarioBr(t.juros) ?? 0;
  const mu = parseValorMonetarioBr(t.multa) ?? 0;
  const ho = parseValorMonetarioBr(t.honorarios) ?? 0;
  return formatBRLTitulo(somaMonetariaTrunc2(vi, am, ju, mu, ho));
}

/**
 * @param {{
 *   dataVencimento?: string|null,
 *   valor?: string|null,
 *   atualizacaoMonetaria?: string|null,
 *   diasAtraso?: string|null,
 *   juros?: string|null,
 *   multa?: string|null,
 *   honorarios?: string|null,
 *   chaveDescricao?: string|null,
 * }} campos
 */
export function tituloFromCamposTaxa(campos) {
  const base = linhaTituloVaziaCalculos();
  const venc = campos.dataVencimento != null ? String(campos.dataVencimento).trim() : '';
  const valorRaw = campos.valor != null ? String(campos.valor).trim() : '';
  if (!venc && !valorRaw) return null;

  const titulo = {
    ...base,
    dataVencimento: venc,
    valorInicial: formatCampoMonetarioTxt(valorRaw),
    atualizacaoMonetaria: formatCampoMonetarioTxt(campos.atualizacaoMonetaria),
    diasAtraso: campos.diasAtraso != null && String(campos.diasAtraso).trim() !== '' ? String(campos.diasAtraso).trim() : '',
    juros: formatCampoMonetarioTxt(campos.juros),
    multa: formatCampoMonetarioTxt(campos.multa),
    honorarios: formatCampoMonetarioTxt(campos.honorarios),
    descricaoValor: campos.chaveDescricao != null ? String(campos.chaveDescricao).trim() : '',
  };
  titulo.total = calcularTotalTituloGrade(titulo);
  return titulo;
}

/** @param {Record<string, unknown>} debito */
export function tituloFromDebitoPayload(debito) {
  if (!debito || typeof debito !== 'object') return null;
  return tituloFromCamposTaxa({
    dataVencimento: debito.dataVencimento,
    valor: debito.valor,
    atualizacaoMonetaria: debito.atualizacaoMonetaria,
    juros: debito.juros,
    multa: debito.multa,
    honorarios: debito.honorarios,
    diasAtraso: debito.diasAtraso,
    chaveDescricao: debito.chaveDescricao,
  });
}

/** @param {unknown[]} titulos */
export function titulosGradeTemValor(titulos) {
  if (!Array.isArray(titulos)) return false;
  return titulos.some((t) => String(t?.valorInicial ?? '').trim() !== '');
}

/**
 * Preenche `titulos[]` a partir de `debitos[]` quando a grade de títulos está vazia (import legado).
 * @param {Record<string, unknown>} rodada
 */
export function enriquecerTitulosAPartirDeDebitosNaRodada(rodada) {
  if (!rodada || typeof rodada !== 'object') return rodada;
  if (titulosGradeTemValor(rodada.titulos)) return rodada;

  const debitos = Array.isArray(rodada.debitos) ? rodada.debitos : [];
  if (!debitos.length) return rodada;

  const titulos = debitos
    .map((d) => tituloFromDebitoPayload(d))
    .filter((t) => t != null);
  if (!titulos.length) return rodada;
  return { ...rodada, titulos };
}
