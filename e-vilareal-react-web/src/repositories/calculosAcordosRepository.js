import { request } from '../api/httpClient.js';

/**
 * @param {object} [params]
 * @param {string} [params.clienteCodigo]
 * @param {string} [params.processos] — lista separada por vírgula
 * @param {string} [params.situacao] — todas | vencidas | a_vencer | pagas | em_aberto
 * @param {string} [params.vencimentoDe] — yyyy-mm-dd
 * @param {string} [params.vencimentoAte]
 * @param {string} [params.ordenarPor]
 * @param {boolean} [params.ordemAsc]
 * @param {number} [params.page]
 * @param {number} [params.size]
 * @param {{ signal?: AbortSignal }} [opts]
 */
export function fetchParcelamentosConsolidado(params = {}, opts = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v) !== '') {
      q.set(k, String(v));
    }
  }
  const qs = q.toString();
  return request(`/api/calculos/parcelamentos/consolidado${qs ? `?${qs}` : ''}`, { signal: opts.signal });
}

/** @param {{ signal?: AbortSignal }} [opts] */
export function fetchParcelamentosResumoKpi(opts = {}) {
  return request('/api/calculos/parcelamentos/resumo-kpi', { signal: opts.signal });
}

/**
 * @param {{ codigoCliente: string, numeroProcesso: number, dimensaoAcordo: number, registrarHistorico?: boolean }} body
 */
export function proporAcordoDescumprido(body) {
  return request('/api/calculos/acordo-descumprido/propor', {
    method: 'POST',
    body: {
      registrarHistorico: true,
      ...body,
    },
  });
}

/** @param {{ processoId: number, origem: string, titulo: string, detalhe: string }} body */
export function registrarAndamentoAcordo(body) {
  return request('/api/calculos/acordos/registrar-andamento', { method: 'POST', body });
}
