import { API_BASE_URL } from '../api/config.js';
import { buildDefaultApiHeaders, emitApiUnauthorized } from '../api/apiAuthHeaders.js';
import { postFormData, request } from '../api/httpClient.js';

/**
 * Extrai unidades e débitos do relatório .xls de inadimplência (sem gravar).
 * @param {File} file
 * @returns {Promise<{
 *   unidades: Array<{
 *     codigoUnidadeNormalizada: string,
 *     proprietarioNome: string,
 *     proprietarioDocDigitos: string,
 *     cobrancas: unknown[],
 *   }>,
 *   condominioNome?: string,
 *   dataReferencia?: string,
 *   resumo?: {
 *     quantidadeUnidades?: number,
 *     quantidadeDebitos?: number,
 *     quantidadePf?: number,
 *     quantidadePj?: number,
 *     valorTotalCentavos?: number,
 *   },
 * }>}
 */
export async function extrairCobranca(file) {
  const fd = new FormData();
  fd.append('arquivo', file);
  return postFormData('/api/cobranca/extrair', fd);
}

/**
 * Extrai unidades e débitos do PDF Condo Id (clientes configurados, ex. 928 ASFAROL).
 * @param {string} clienteCodigo
 * @param {File} file
 */
export async function extrairCobrancaPdf(clienteCodigo, file) {
  const fd = new FormData();
  fd.append('clienteCodigo', String(clienteCodigo ?? '').trim());
  fd.append('arquivo', file);
  return postFormData('/api/cobranca/extrair-pdf', fd);
}

/**
 * @param {{
 *   clienteCodigo: string,
 *   unidades: Array<{
 *     codigoUnidadeNormalizada: string,
 *     proprietarioNome: string,
 *     proprietarioDocDigitos: string,
 *     cobrancas: unknown[],
 *   }>,
 * }} payload
 */
export async function processarCobranca(payload) {
  return request('/api/cobranca/processar', { method: 'POST', body: payload });
}

/**
 * Relatório de execução persistido (JSON).
 * @param {string} importacaoId
 */
export async function buscarRelatorio(importacaoId) {
  return request(`/api/cobranca/relatorio/${encodeURIComponent(importacaoId)}`);
}

/**
 * PDF do relatório de execução (blob + nome do arquivo).
 * @param {string} importacaoId
 * @param {{ signal?: AbortSignal }} [opts]
 * @returns {Promise<{ blob: Blob, filename: string }>}
 */
export async function baixarRelatorioPdf(importacaoId, opts = {}) {
  const url = `${API_BASE_URL}/api/cobranca/relatorio/${encodeURIComponent(importacaoId)}/pdf`;
  const res = await fetch(url, { method: 'GET', headers: buildDefaultApiHeaders(), signal: opts.signal });
  if (res.status === 401) emitApiUnauthorized();
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Erro ${res.status} ao baixar relatório PDF.`);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = /filename="([^"]+)"/i.exec(disposition);
  const filename = match?.[1] || `relatorio-cobranca-${importacaoId}.pdf`;
  return { blob, filename };
}
