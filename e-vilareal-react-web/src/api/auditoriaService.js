import { API_BASE_URL } from './config.js';
import { buildDefaultApiHeaders } from './apiAuthHeaders.js';
import { parseApiJsonResponse } from './parseApiResponse.js';

const BASE = `${API_BASE_URL}/api/auditoria/atividades`;

function mergeHeaders(extra = {}) {
  return buildDefaultApiHeaders(extra);
}

/**
 * @param {object} params
 * @param {string} [params.dataInicio] - yyyy-MM-dd
 * @param {string} [params.dataFim] - yyyy-MM-dd
 * @param {string} [params.usuarioId]
 * @param {string} [params.modulo]
 * @param {string} [params.tipoAcao]
 * @param {string} [params.registroAfetadoId]
 * @param {string} [params.q] - busca textual
 * @param {number} [params.page]
 * @param {number} [params.size]
 * @param {string} [params.sort] - ex: ocorridoEm,desc
 */
export async function listarAtividadesAuditoria(params = {}) {
  const sp = new URLSearchParams();
  if (params.dataInicio) sp.set('dataInicio', params.dataInicio);
  if (params.dataFim) sp.set('dataFim', params.dataFim);
  if (params.usuarioId) sp.set('usuarioId', params.usuarioId);
  if (params.modulo) sp.set('modulo', params.modulo);
  if (params.tipoAcao) sp.set('tipoAcao', params.tipoAcao);
  if (params.registroAfetadoId) sp.set('registroAfetadoId', params.registroAfetadoId);
  if (params.q) sp.set('q', params.q);
  sp.set('page', String(params.page ?? 0));
  sp.set('size', String(params.size ?? 20));
  sp.set('sort', params.sort ?? 'ocorridoEm,desc');

  const res = await fetch(`${BASE}?${sp.toString()}`, {
    method: 'GET',
    headers: mergeHeaders(),
  });
  return parseApiJsonResponse(res);
}
