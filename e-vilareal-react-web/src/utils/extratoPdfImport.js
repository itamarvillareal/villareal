/**
 * Importação de extrato bancário por PDF (roteamento por instituição).
 */

import { extrairTextoPdfDeArquivo } from '../data/publicacoesPdfExtract.js';
import { rodarOcrPdfTodasPaginas } from '../services/documentOcrService.js';
import { isInstituicaoBtgExtratoPdf, parseBtgPdfExtratoText, textoPareceTerLancamentosBtgApp } from './btgPdfExtrato.js';
import {
  isInstituicaoBradescoExtratoPdf,
  parseBradescoPdfExtratoText,
  textoPareceExtratoBradescoCelular,
} from './bradescoPdfExtrato.js';
import { isInstituicaoPay99ExtratoPdf, parsePay99PdfExtratoText } from './pay99PdfExtrato.js';
import { isInstituicaoSicoobExtratoPdf, parseSicoobPdfExtratoText } from './sicoobPdfExtrato.js';

export {
  isInstituicaoBtgExtratoPdf,
  isInstituicaoBradescoExtratoPdf,
  isInstituicaoPay99ExtratoPdf,
  isInstituicaoSicoobExtratoPdf,
};

/** Instituições cujo extrato oficial é importado por PDF (não OFX). */
export function isInstituicaoExtratoPdfImport(nome) {
  return (
    isInstituicaoBtgExtratoPdf(nome) ||
    isInstituicaoBradescoExtratoPdf(nome) ||
    isInstituicaoSicoobExtratoPdf(nome) ||
    isInstituicaoPay99ExtratoPdf(nome)
  );
}

export function rotuloInstituicaoExtratoPdf(nome) {
  if (isInstituicaoBtgExtratoPdf(nome)) return 'BTG Pactual';
  if (isInstituicaoBradescoExtratoPdf(nome)) return 'Bradesco Celular';
  if (isInstituicaoSicoobExtratoPdf(nome)) return 'Sicoob (SISBR)';
  if (isInstituicaoPay99ExtratoPdf(nome)) return '99 Pay';
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
  if (isInstituicaoBradescoExtratoPdf(nomeInstituicao)) {
    return parseBradescoPdfExtratoText(textoBruto);
  }
  if (isInstituicaoBtgExtratoPdf(nomeInstituicao)) {
    return parseBtgPdfExtratoText(textoBruto);
  }
  if (isInstituicaoPay99ExtratoPdf(nomeInstituicao)) {
    return parsePay99PdfExtratoText(textoBruto);
  }
  return [];
}

/**
 * Mensagem amigável quando o PDF não gera lançamentos (ex.: extrato BTG vazio).
 * @param {string} textoBruto
 * @param {string} nomeInstituicao
 */
export function mensagemFalhaExtratoPdf(textoBruto, nomeInstituicao) {
  const rotulo = rotuloInstituicaoExtratoPdf(nomeInstituicao);
  const texto = String(textoBruto ?? '');

  if (isInstituicaoBtgExtratoPdf(nomeInstituicao)) {
    const periodo = texto.match(/(\d{2}\/\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{2}\/\d{4})/i);
    const saldoZero = /saldo\s+final\s*R?\$?\s*0,00/i.test(texto.replace(/\s+/g, ' '));
    const temSecaoLancamentos = /lan[cç]amentos/i.test(texto);
    if (periodo && temSecaoLancamentos && saldoZero && !textoPareceTerLancamentosBtgApp(texto)) {
      return (
        `O PDF do BTG não traz lançamentos no período ${periodo[1]} a ${periodo[2]} ` +
        `(saldo final R$ 0,00). Exporte no app BTG um extrato mensal ou anual com movimentação.`
      );
    }
  }

  if (isInstituicaoBradescoExtratoPdf(nomeInstituicao) && textoPareceExtratoBradescoCelular(texto)) {
    return (
      'Não foi possível extrair lançamentos do PDF Bradesco Celular. ' +
      'Confira se o extrato tem movimentação no período (evite a folha «Extrato inexistente»).'
    );
  }

  return `Não foi possível extrair lançamentos do PDF (${rotulo}).`;
}

/**
 * Extrai texto (pdf.js + OCR quando necessário) e parseia lançamentos.
 * @param {File} file
 * @param {string} nomeInstituicao
 * @returns {Promise<{ rows: object[], texto: string, fonte: 'pdf_texto' | 'ocr' }>}
 */
export async function carregarLancamentosDeExtratoPdf(file, nomeInstituicao) {
  let texto = await extrairTextoPdfDeArquivo(file, { ordenarItensPorPosicao: true });
  let fonte = 'pdf_texto';
  let rows = parseExtratoPdfText(texto, nomeInstituicao);

  if (!rows.length) {
    try {
      const ocrTexto = await rodarOcrPdfTodasPaginas(file, { scale: 2.5 });
      const ocrLen = ocrTexto.replace(/\s/g, '').length;
      const natLen = texto.replace(/\s/g, '').length;
      if (ocrLen > natLen + 16) {
        const ocrRows = parseExtratoPdfText(ocrTexto, nomeInstituicao);
        if (ocrRows.length > 0 || ocrLen > natLen) {
          texto = ocrTexto;
          fonte = 'ocr';
          rows = ocrRows;
        }
      }
    } catch {
      /* OCR opcional — mantém texto nativo */
    }
  }

  return { rows, texto, fonte };
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
