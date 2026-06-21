import { request } from '../api/httpClient.js';
import { featureFlags } from '../config/featureFlags.js';

/** Carteira de repasses de alvará pendentes/divergentes (processos). */
export async function listarRepassesPendentesHonorarioApi(opts = {}) {
  if (!featureFlags.useApiFinanceiro) return { totalEmAberto: 0, itens: [] };
  return request('/api/honorarios/repasses-pendentes', { signal: opts.signal });
}

/** Classifica crédito como alvará (idempotente). */
export async function classificarAlvaraHonorarioApi(lancamentoId, opts = {}) {
  return request('/api/honorarios/classificar-alvara', {
    method: 'POST',
    body: { lancamentoId: Number(lancamentoId) },
    signal: opts.signal,
  });
}

/** Vincula débito como repasse ao contratante. */
export async function vincularRepasseHonorarioApi(lancamentoDebitoId, alvaraLancamentoId, opts = {}) {
  return request('/api/honorarios/vincular-repasse', {
    method: 'POST',
    body: {
      lancamentoDebitoId: Number(lancamentoDebitoId),
      alvaraLancamentoId: alvaraLancamentoId != null ? Number(alvaraLancamentoId) : null,
    },
    signal: opts.signal,
  });
}
