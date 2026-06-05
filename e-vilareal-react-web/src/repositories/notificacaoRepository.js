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

function normalizarPayload({ whatsapp, email }) {
  return {
    whatsapp: Array.isArray(whatsapp) ? whatsapp : [],
    email: Array.isArray(email) ? email : [],
  };
}

/** @returns {Promise<{ whatsapp: string[], email: string[] }>} */
export async function getDestinatariosPadrao() {
  return request('/api/notificacao/destinatarios/padrao');
}

/**
 * @param {{ whatsapp?: string[], email?: string[] }} payload
 * @returns {Promise<{ whatsapp: string[], email: string[] }>}
 */
export async function putDestinatariosPadrao(payload) {
  return request('/api/notificacao/destinatarios/padrao', {
    method: 'PUT',
    body: normalizarPayload(payload),
  });
}

/**
 * @returns {Promise<{
 *   override: { whatsapp: string[], email: string[] },
 *   personalizado: boolean,
 *   efetivo: { whatsapp: string[], email: string[] }
 * }>}
 */
export async function getDestinatariosProcesso(processoId) {
  const id = exigirProcessoId(processoId);
  return request(`/api/processos/${id}/notificacao/destinatarios`);
}

/**
 * @param {number|string} processoId
 * @param {{ whatsapp?: string[], email?: string[] }} payload
 */
export async function putDestinatariosProcesso(processoId, payload) {
  const id = exigirProcessoId(processoId);
  return request(`/api/processos/${id}/notificacao/destinatarios`, {
    method: 'PUT',
    body: normalizarPayload(payload),
  });
}

/** @param {number|string} processoId */
export async function removerDestinatariosProcesso(processoId) {
  const id = exigirProcessoId(processoId);
  return request(`/api/processos/${id}/notificacao/destinatarios`, { method: 'DELETE' });
}
