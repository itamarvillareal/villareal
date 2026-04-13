import { API_BASE_URL } from '../api/config.js';
import { buildDefaultApiHeaders } from '../api/apiAuthHeaders.js';
import { parseApiJsonResponse } from '../api/parseApiResponse.js';
import { request } from '../api/httpClient.js';

/**
 * Mapa completo de rodadas (GET global). **Só migração / admin** — o fluxo normal usa resumo + GET por chave.
 * @param {{ signal?: AbortSignal }} [opts]
 * @returns {Promise<{ rodadas: Record<string, object> }>}
 */
export function fetchCalculoRodadas(opts = {}) {
  return request('/api/calculos/rodadas', { signal: opts.signal });
}

/** @param {{ signal?: AbortSignal }} [opts] */
export function fetchCalculoRodadasResumo(opts = {}) {
  return request('/api/calculos/rodadas/resumo', { signal: opts.signal });
}

/**
 * Uma rodada por chave. {@code null} se 404 (sem corpo).
 * @param {{ signal?: AbortSignal }} [opts]
 * @returns {Promise<object | null>}
 */
export async function fetchCalculoRodada(codigoCliente8, processo, dimensao, opts = {}) {
  const c = encodeURIComponent(String(codigoCliente8 ?? '').trim());
  const p = encodeURIComponent(String(processo ?? '').trim());
  const d = encodeURIComponent(String(dimensao ?? '').trim());
  const response = await fetch(`${API_BASE_URL}/api/calculos/rodadas/${c}/${p}/${d}`, {
    method: 'GET',
    headers: { ...buildDefaultApiHeaders() },
    signal: opts.signal,
  });
  if (response.status === 404) return null;
  return parseApiJsonResponse(response);
}

/** Upsert de uma rodada (não apaga outras chaves no servidor). */
export function putCalculoRodada(codigoCliente8, processo, dimensao, payload) {
  const c = encodeURIComponent(String(codigoCliente8 ?? '').trim());
  const p = encodeURIComponent(String(processo ?? '').trim());
  const d = encodeURIComponent(String(dimensao ?? '').trim());
  return request(`/api/calculos/rodadas/${c}/${p}/${d}`, { method: 'PUT', body: payload ?? {} });
}

/** Substitui todas as rodadas no servidor (espelha save completo do front). */
export function putCalculoRodadas(rodadas) {
  return request('/api/calculos/rodadas', { method: 'PUT', body: { rodadas } });
}

/** @returns {Promise<{ config: object }>} */
export function fetchCalculoConfigCliente(codigoCliente8) {
  const cod = encodeURIComponent(String(codigoCliente8 ?? '').trim());
  return request(`/api/calculos/config-cliente/${cod}`);
}

/** @returns {Promise<{ config: object }>} */
export function putCalculoConfigCliente(codigoCliente8, patch) {
  const cod = encodeURIComponent(String(codigoCliente8 ?? '').trim());
  return request(`/api/calculos/config-cliente/${cod}`, { method: 'PUT', body: patch ?? {} });
}
