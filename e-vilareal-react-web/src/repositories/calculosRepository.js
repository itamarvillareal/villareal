import { request } from '../api/httpClient.js';

/** @returns {Promise<{ rodadas: Record<string, object> }>} */
export function fetchCalculoRodadas() {
  return request('/api/calculos/rodadas');
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
