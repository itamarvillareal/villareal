import { request } from '../api/httpClient.js';
import { featureFlags } from '../config/featureFlags.js';

/**
 * Camada API-first para tarefas operacionais (Fase 8).
 * Com `useApiTarefas` desligado, os métodos retornam null — o Board usa legado (localStorage).
 *
 * Nomenclatura backend (query string em GET /api/tarefas):
 * - `responsavelId` — filtra pelo id do usuário responsável (Long).
 * Resposta JSON: `responsavelUsuarioId` — mesmo id, nome alinhado ao DTO.
 */

/**
 * @param {object} [opcoes]
 * @param {number|string} [opcoes.responsavelId] — query param do backend (não usar `responsavelUsuarioId` aqui).
 * @param {string} [opcoes.status] — PENDENTE | EM_ANDAMENTO | CONCLUIDA | CANCELADA
 * @param {string} [opcoes.prioridade] — BAIXA | NORMAL | ALTA | URGENTE
 * @param {number|string} [opcoes.clienteId]
 * @param {number|string} [opcoes.processoId]
 * @param {string} [opcoes.dataLimiteDe] — ISO date (yyyy-MM-dd)
 * @param {string} [opcoes.dataLimiteAte] — ISO date (yyyy-MM-dd)
 */
export async function listarTarefasOperacionais(opcoes = {}) {
  if (!featureFlags.useApiTarefas) return null;
  const query = {};
  if (opcoes.responsavelId != null && opcoes.responsavelId !== '') {
    query.responsavelId = Number(opcoes.responsavelId);
  }
  if (opcoes.status) query.status = opcoes.status;
  if (opcoes.prioridade) query.prioridade = opcoes.prioridade;
  if (opcoes.clienteId != null && opcoes.clienteId !== '') query.clienteId = Number(opcoes.clienteId);
  if (opcoes.processoId != null && opcoes.processoId !== '') query.processoId = Number(opcoes.processoId);
  if (opcoes.dataLimiteDe) query.dataLimiteDe = opcoes.dataLimiteDe;
  if (opcoes.dataLimiteAte) query.dataLimiteAte = opcoes.dataLimiteAte;
  return request('/api/tarefas', { query });
}

export async function buscarTarefaOperacional(id) {
  if (!featureFlags.useApiTarefas) return null;
  return request(`/api/tarefas/${Number(id)}`);
}

export async function criarTarefaOperacional(body) {
  if (!featureFlags.useApiTarefas) return null;
  return request('/api/tarefas', { method: 'POST', body });
}

export async function atualizarTarefaOperacional(id, body) {
  if (!featureFlags.useApiTarefas) return null;
  return request(`/api/tarefas/${Number(id)}`, { method: 'PUT', body });
}

export async function patchStatusTarefaOperacional(id, body) {
  if (!featureFlags.useApiTarefas) return null;
  return request(`/api/tarefas/${Number(id)}/status`, { method: 'PATCH', body });
}
