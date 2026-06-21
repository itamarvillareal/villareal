import { request } from '../api/httpClient.js';

/**
 * @param {{ periodo?: 'ESTE_MES'|'PROXIMO_MES', inicio?: string, fim?: string }} params
 */
export async function obterQuadroRecebiveisApi(params = {}) {
  const { periodo, inicio, fim } = params;
  return request('/api/recebiveis/quadro', {
    query: {
      periodo: periodo || undefined,
      inicio: inicio || undefined,
      fim: fim || undefined,
    },
  });
}
