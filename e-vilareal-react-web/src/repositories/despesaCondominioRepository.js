import { request } from '../api/httpClient.js';

/** Candidatos read-only: débitos recorrentes de condomínio no extrato. */
export async function listarCandidatosDespesaCondominioApi(opts = {}) {
  return request('/api/locacoes/despesas-condominio/candidatos', { signal: opts.signal });
}

/** Confirma condomínio pago pelo escritório → flag no imóvel + recorrência A Pagar. */
export async function confirmarDespesaCondominioApi(body, opts = {}) {
  return request('/api/locacoes/despesas-condominio/confirmar', {
    method: 'POST',
    body,
    signal: opts.signal,
  });
}
