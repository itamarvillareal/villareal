import { request } from '../api/httpClient.js';

function exigirIdPositivo(valor, mensagem) {
  const id = Number(valor);
  if (!Number.isFinite(id) || id < 1) {
    throw new Error(mensagem);
  }
  return id;
}

function exigirProcessoId(processoId) {
  return exigirIdPositivo(processoId, 'Informe um processo válido.');
}

function exigirAgendamentoId(agendamentoId) {
  return exigirIdPositivo(agendamentoId, 'Informe um agendamento válido.');
}

/** @returns {Promise<import('../domain/agendamentoCadencia.js').PainelItem[]>} */
export async function listarPainel() {
  return request('/api/agendamentos/painel');
}

/** @returns {Promise<object[]>} */
export async function listarAgendamentosProcesso(processoId) {
  const id = exigirProcessoId(processoId);
  return request(`/api/processos/${id}/agendamentos`);
}

/**
 * @param {number|string} processoId
 * @param {Record<string, unknown>} body
 */
export async function criarAgendamento(processoId, body) {
  const id = exigirProcessoId(processoId);
  return request(`/api/processos/${id}/agendamentos`, { method: 'POST', body });
}

/**
 * @param {number|string} id
 * @param {Record<string, unknown>} body
 */
export async function atualizarAgendamento(id, body) {
  const agId = exigirAgendamentoId(id);
  return request(`/api/agendamentos/${agId}`, { method: 'PUT', body });
}

/** @param {number|string} id */
export async function pausarAgendamento(id) {
  const agId = exigirAgendamentoId(id);
  return request(`/api/agendamentos/${agId}/pausar`, { method: 'POST' });
}

/** @param {number|string} id */
export async function retomarAgendamento(id) {
  const agId = exigirAgendamentoId(id);
  return request(`/api/agendamentos/${agId}/retomar`, { method: 'POST' });
}

/** @param {number|string} id */
export async function removerAgendamento(id) {
  const agId = exigirAgendamentoId(id);
  return request(`/api/agendamentos/${agId}`, { method: 'DELETE' });
}

/**
 * @param {number|string} processoId
 * @param {number} [page=0]
 * @param {number} [size=20]
 */
/** @returns {Promise<{ habilitada: boolean }>} */
export async function getConsultaPeriodicaHabilitada(processoId) {
  const id = exigirProcessoId(processoId);
  return request(`/api/processos/${id}/consulta-periodica/habilitada`);
}

/**
 * @param {number|string} processoId
 * @param {boolean} habilitada
 * @returns {Promise<{ habilitada: boolean }>}
 */
export async function putConsultaPeriodicaHabilitada(processoId, habilitada) {
  const id = exigirProcessoId(processoId);
  return request(`/api/processos/${id}/consulta-periodica/habilitada`, {
    method: 'PUT',
    body: { habilitada: Boolean(habilitada) },
  });
}

export async function listarExecucoesProcesso(processoId, page = 0, size = 20) {
  const id = exigirProcessoId(processoId);
  const p = Number(page);
  const s = Number(size);
  const pageSafe = Number.isFinite(p) && p >= 0 ? Math.floor(p) : 0;
  const sizeSafe = Number.isFinite(s) && s > 0 ? Math.floor(s) : 20;
  return request(`/api/processos/${id}/execucoes`, {
    query: { page: String(pageSafe), size: String(sizeSafe) },
  });
}
