import { API_BASE_URL } from './config.js';
import { buildDefaultApiHeaders, emitApiUnauthorized } from './apiAuthHeaders.js';
import { postFormData, request } from './httpClient.js';

/**
 * @typedef {Object} ProjudiPeticaoArquivo
 * @property {number} [id]
 * @property {number} ordem
 * @property {number} idArquivoTipo
 * @property {string|null} nomeOriginal
 * @property {string} status
 * @property {string|null} [criadoEm]
 */

/**
 * @typedef {Object} ProjudiPeticao
 * @property {number} id
 * @property {number} credencialId
 * @property {string} numeroProcesso
 * @property {string|null} complemento
 * @property {string} status
 * @property {string|null} criadoEm
 * @property {string|null} protocoladoEm
 * @property {string|null} protocoloMensagem
 * @property {ProjudiPeticaoArquivo[]} arquivos
 */

/** @param {FormData} formData */
export async function registrar(formData) {
  return postFormData('/api/projudi/peticoes', formData);
}

/** @param {FormData} formData */
export async function registrarAssinados(formData) {
  return postFormData('/api/projudi/peticoes/registrar-assinados', formData);
}

/**
 * @param {string} [status]
 * @returns {Promise<ProjudiPeticao[]>}
 */
export async function listar(status) {
  const query = status ? { status } : undefined;
  return request('/api/projudi/peticoes', { query });
}

/** @returns {Promise<{ blob: Blob, filename: string }>} */
export async function baixarZip(opts = {}) {
  const url = `${API_BASE_URL}/api/projudi/peticoes/lote-assinar.zip`;
  const res = await fetch(url, {
    method: 'GET',
    headers: buildDefaultApiHeaders(),
    signal: opts.signal,
  });
  if (res.status === 401) emitApiUnauthorized();
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Erro ${res.status} ao baixar ZIP.`);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = /filename="([^"]+)"/i.exec(disposition);
  const filename = match?.[1] || 'lote-assinar.zip';
  return { blob, filename };
}

/** @param {FormData} formData — campos arquivosP7s (.p7s apenas, nunca PDF) */
export async function enviarAssinados(formData) {
  return postFormData('/api/projudi/peticoes/assinados', formData);
}

/**
 * @param {number[]} peticaoIds
 * @returns {Promise<Array<{ peticaoId: number, numeroProcesso: string, resultado: string, mensagem: string|null }>>}
 */
export async function protocolarLote(peticaoIds) {
  return request('/api/projudi/peticoes/protocolar-lote', {
    method: 'POST',
    body: { peticaoIds, confirmar: true },
  });
}

/**
 * @param {string} numeroProcesso
 * @returns {Promise<ProjudiPeticao[]>}
 */
export async function listarPorProcesso(numeroProcesso) {
  return request('/api/projudi/peticoes/por-processo', {
    query: { numeroProcesso },
  });
}

export async function previaProtocoloLote(peticaoIds) {
  return request('/api/projudi/peticoes/previa-lote', {
    method: 'POST',
    body: { peticaoIds },
  });
}

export async function validarProtocoloLote(peticaoIds) {
  return request('/api/projudi/peticoes/validar-lote', {
    method: 'POST',
    body: { peticaoIds },
  });
}

export async function previaProtocolo(numeroProcesso) {
  return request('/api/projudi/peticoes/previa-protocolo', {
    query: { numeroProcesso },
  });
}

/** Valida no PROJUDI até passo 10 — não executa Concluir. */
export async function validarProtocolo(numeroProcesso) {
  return request('/api/projudi/peticoes/validar-protocolo', {
    method: 'POST',
    body: { numeroProcesso },
  });
}

/**
 * @param {string} numeroProcesso
 * @returns {Promise<Array<{ peticaoId: number, numeroProcesso: string, resultado: string, mensagem: string|null }>>}
 */
export async function protocolarProcesso(numeroProcesso) {
  return request('/api/projudi/peticoes/protocolar-processo', {
    method: 'POST',
    body: { numeroProcesso, confirmar: true },
  });
}

export async function listarCredenciais() {
  return request('/api/projudi/peticoes/credenciais');
}

/** @param {number} peticaoId */
export async function reabrirProtocolo(peticaoId) {
  return request(`/api/projudi/peticoes/${peticaoId}/reabrir-protocolo`, { method: 'POST' });
}

/** @param {number} peticaoId @param {number} credencialId */
export async function atualizarCredencialPeticao(peticaoId, credencialId) {
  return request(`/api/projudi/peticoes/${peticaoId}/credencial`, {
    method: 'POST',
    body: { credencialId },
  });
}

/** @param {number} peticaoId */
export async function excluirPeticao(peticaoId) {
  return request(`/api/projudi/peticoes/${peticaoId}`, { method: 'DELETE' });
}

/** @param {number} peticaoId @param {number} arquivoId */
export async function excluirArquivo(peticaoId, arquivoId) {
  return request(`/api/projudi/peticoes/${peticaoId}/arquivos/${arquivoId}`, { method: 'DELETE' });
}
