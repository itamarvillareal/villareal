/**
 * Importação de extrato bancário por PDF (roteamento por instituição).
 */

import { isInstituicaoBtgExtratoPdf, parseBtgPdfExtratoText } from './btgPdfExtrato.js';
import { isInstituicaoSicoobExtratoPdf, parseSicoobPdfExtratoText } from './sicoobPdfExtrato.js';

export { isInstituicaoBtgExtratoPdf, isInstituicaoSicoobExtratoPdf };

/** Instituições cujo extrato oficial é importado por PDF (não OFX). */
export function isInstituicaoExtratoPdfImport(nome) {
  return isInstituicaoBtgExtratoPdf(nome) || isInstituicaoSicoobExtratoPdf(nome);
}

export function rotuloInstituicaoExtratoPdf(nome) {
  if (isInstituicaoBtgExtratoPdf(nome)) return 'BTG Pactual';
  if (isInstituicaoSicoobExtratoPdf(nome)) return 'Sicoob (SISBR)';
  return 'PDF';
}

/**
 * @param {string} textoBruto
 * @param {string} nomeInstituicao
 * @returns {Array<Record<string, unknown>>}
 */
export function parseExtratoPdfText(textoBruto, nomeInstituicao) {
  if (isInstituicaoSicoobExtratoPdf(nomeInstituicao)) {
    return parseSicoobPdfExtratoText(textoBruto);
  }
  if (isInstituicaoBtgExtratoPdf(nomeInstituicao)) {
    return parseBtgPdfExtratoText(textoBruto);
  }
  return [];
}

/** @param {File | null | undefined} file */
export function arquivoExtratoEhPdf(file) {
  const nome = String(file?.name ?? '').toLowerCase();
  const tipo = String(file?.type ?? '').toLowerCase();
  return nome.endsWith('.pdf') || tipo === 'application/pdf';
}

/** @param {File | null | undefined} file */
export function arquivoExtratoEhOfx(file) {
  const nome = String(file?.name ?? '').toLowerCase();
  const tipo = String(file?.type ?? '').toLowerCase();
  return (
    nome.endsWith('.ofx') ||
    nome.endsWith('.qfx') ||
    tipo.includes('ofx') ||
    tipo === 'application/x-ofx' ||
    tipo === 'text/ofx'
  );
}
