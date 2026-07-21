/**
 * Custas judiciais — grade separada dos títulos (paridade VBA §10 / Calculo_Linha_Custas_Judiciais).
 * Atualização monetária + juros; sem multa e sem honorários por linha.
 */

import { formatBRL } from '../components/calculos/calculosTitulosGridUtils.js';
import { parseBRLToCentavos } from '../utils/moneyBr.js';

export const CUSTAS_POR_PAGINA = 20;
export const CUSTAS_TOTAL_LINHAS = 20;

function trunc2(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.trunc(v * 100) / 100;
}

function somaCentavosBRL(...campos) {
  return campos.reduce((acc, campo) => {
    const c = parseBRLToCentavos(campo);
    return acc + (c ?? 0);
  }, 0);
}

function formatBRLCentavos(centavos) {
  return formatBRL(centavos / 100);
}

export function linhaCustasVaziaCalculos() {
  return {
    dataPagamento: '',
    valor: '',
    atualizacaoMonetaria: '',
    juros: '',
    total: '',
  };
}

export function gerarCustasMock() {
  return Array.from({ length: CUSTAS_TOTAL_LINHAS }, () => linhaCustasVaziaCalculos());
}

/** @param {unknown} lista */
export function custasGradeTemValor(lista) {
  return (Array.isArray(lista) ? lista : []).some(
    (r) => String(r?.valor ?? '').trim() !== '' || String(r?.dataPagamento ?? '').trim() !== ''
  );
}

/** @param {Record<string, unknown>} row */
export function calcularTotalLinhaCustas(row) {
  const base = row && typeof row === 'object' ? { ...row } : linhaCustasVaziaCalculos();
  const principalStr = String(base.valor ?? '').trim();
  if (principalStr === '') {
    return { ...base, total: '' };
  }
  const totalCentavos = somaCentavosBRL(base.valor, base.atualizacaoMonetaria, base.juros);
  return { ...base, total: formatBRLCentavos(totalCentavos) };
}

/**
 * Soma colunas da grade de custas (linhas com valor preenchido).
 * @param {Array<Record<string, unknown>> | undefined} lista
 */
export function calcularResumoCustasGrade(lista) {
  const valid = (lista || []).filter((r) => String(r?.valor ?? '').trim() !== '');
  const qtd = valid.length;

  let cValor = 0;
  let cAtualizacao = 0;
  let cJuros = 0;
  for (const r of valid) {
    cValor += parseBRLToCentavos(r.valor) ?? 0;
    cAtualizacao += parseBRLToCentavos(r.atualizacaoMonetaria) ?? 0;
    cJuros += parseBRLToCentavos(r.juros) ?? 0;
  }
  const cTotal = cValor + cAtualizacao + cJuros;
  const qtdLabel = `${String(qtd).padStart(2, '0')} custa${qtd === 1 ? '' : 's'}`;

  return {
    qtd: qtdLabel,
    valor: formatBRLCentavos(cValor),
    atualizacao: formatBRLCentavos(cAtualizacao),
    juros: formatBRLCentavos(cJuros),
    total: formatBRLCentavos(cTotal),
  };
}

/**
 * Valor por parcela das custas após parcelamento (informativo — legado Calculos_Parcelamento).
 * @param {number} valorFinalCustas
 * @param {number} valorFinalTaxas
 * @param {number} valorParcela
 * @param {number} nParcelas
 */
export function calcularValorCustasParcelaLegado(valorFinalCustas, valorFinalTaxas, valorParcela, nParcelas) {
  const custas = trunc2(Number(valorFinalCustas) || 0);
  const taxas = trunc2(Number(valorFinalTaxas) || 0);
  const parc = trunc2(Number(valorParcela) || 0);
  const n = Math.max(0, Math.floor(Number(nParcelas) || 0));
  if (custas <= 0 || n <= 0 || parc <= 0) return 0;
  if (n === 1) return custas;
  const mediaBase = (custas + taxas) / n;
  return trunc2(custas / n + ((parc - mediaBase) / parc) * (custas / n));
}

/**
 * Garante array de custas com tamanho mínimo.
 * @param {unknown[]} custasAtual
 */
export function garantirArrayCustas(custasAtual) {
  const arr = Array.isArray(custasAtual) ? [...custasAtual] : [];
  while (arr.length < CUSTAS_TOTAL_LINHAS) {
    arr.push(linhaCustasVaziaCalculos());
  }
  return arr;
}
