import { request } from '../api/httpClient.js';

export async function getWhatsAppStats(signal) {
  return request('/api/whatsapp/stats', { signal });
}

export async function getWhatsAppMessages(phoneNumber, page = 0, size = 20, signal) {
  return request('/api/whatsapp/messages', {
    query: { phoneNumber, page, size },
    signal,
  });
}

export async function getWhatsAppConversations(page = 0, size = 50, signal) {
  return request('/api/whatsapp/conversations', {
    query: { page, size },
    signal,
  });
}

export async function getWhatsAppMessagesByCliente(clienteId, page = 0, size = 20, signal) {
  return request(`/api/whatsapp/messages/cliente/${clienteId}`, {
    query: { page, size },
    signal,
  });
}

export async function getWhatsAppScheduled(status, page = 0, size = 20, signal) {
  const query = { page, size };
  if (status) query.status = status;
  return request('/api/whatsapp/scheduled', { query, signal });
}

export async function sendWhatsAppText(phoneNumber, message) {
  return request('/api/whatsapp/send', {
    method: 'POST',
    body: { phoneNumber, message },
  });
}

export async function sendWhatsAppTemplate(phoneNumber, templateName, languageCode, parameters) {
  return request('/api/whatsapp/send-template', {
    method: 'POST',
    body: { phoneNumber, templateName, languageCode, parameters },
  });
}

export async function createWhatsAppSchedule(data) {
  return request('/api/whatsapp/schedule', {
    method: 'POST',
    body: data,
  });
}

export async function cancelWhatsAppSchedule(id) {
  return request(`/api/whatsapp/schedule/${id}`, { method: 'DELETE' });
}

export async function getWhatsAppTemplates(signal) {
  return request('/api/whatsapp/templates', { signal });
}

export async function createWhatsAppTemplate(name, category, bodyText, exampleValues) {
  return request('/api/whatsapp/templates', {
    method: 'POST',
    body: { name, category, bodyText, exampleValues },
  });
}

export async function deleteWhatsAppTemplate(name, hsmId) {
  const query = {};
  if (hsmId) query.hsmId = hsmId;
  return request(`/api/whatsapp/templates/${encodeURIComponent(name)}`, { method: 'DELETE', query });
}

export async function getWhatsAppAniversarios(ano, page = 0, size = 20, signal) {
  return request('/api/whatsapp/aniversarios', {
    query: { ano, page, size },
    signal,
  });
}

export async function getProximosAniversarios(dias = 30, signal) {
  return request('/api/whatsapp/aniversarios/proximos', {
    query: { dias },
    signal,
  });
}

export async function getAniversarioStats(signal) {
  return request('/api/whatsapp/aniversarios/stats', { signal });
}

export async function enviarAniversarioManual(pessoaId) {
  return request(`/api/whatsapp/aniversarios/enviar-manual/${pessoaId}`, { method: 'POST' });
}

export async function getWhatsAppUnreadCount(signal) {
  return request('/api/whatsapp/notifications/unread-count', { signal });
}

export async function getWhatsAppRecentConversations(limit = 10, signal) {
  return request('/api/whatsapp/conversations/recent', {
    query: { limit },
    signal,
  });
}

export async function getCondominiosCobranca(signal) {
  return request('/api/whatsapp/cobrancas/condominios', { signal });
}

export async function getClientesEscritorioCobranca(signal) {
  return request('/api/whatsapp/cobrancas/clientes-escritorio', { signal });
}

export async function getCobrancaPreview({ condominioId, condominio, clienteId, clienteEscritorioCodigo } = {}, signal) {
  const query = {};
  if (condominioId != null) query.condominioId = condominioId;
  if (condominio) query.condominio = condominio;
  if (clienteId != null) query.clienteId = clienteId;
  if (clienteEscritorioCodigo) query.clienteEscritorioCodigo = clienteEscritorioCodigo;
  return request('/api/whatsapp/cobrancas/preview', { query, signal });
}

export async function dispararCobrancas(itens, loteDescricao) {
  return request('/api/whatsapp/cobrancas/disparar', {
    method: 'POST',
    body: { itens, loteDescricao },
  });
}

export async function agendarCobrancas(itens, loteDescricao, scheduledAt) {
  return request('/api/whatsapp/cobrancas/agendar', {
    method: 'POST',
    body: { itens, loteDescricao, scheduledAt },
  });
}

export async function cancelarCobrancasAgendadas(loteId) {
  return request(`/api/whatsapp/cobrancas/agendar/${encodeURIComponent(loteId)}`, { method: 'DELETE' });
}

export async function cancelCobrancaAgendamentoItem(cobrancaId) {
  return request(`/api/whatsapp/cobrancas/agendar/item/${encodeURIComponent(cobrancaId)}`, { method: 'DELETE' });
}

/** Cancela agendamento conforme origem (MESSAGE ou COBRANCA). */
export async function cancelWhatsAppScheduledItem(item) {
  if (String(item?.source ?? '').toUpperCase() === 'COBRANCA') {
    return cancelCobrancaAgendamentoItem(item.id);
  }
  return cancelWhatsAppSchedule(item.id);
}

export function scheduledItemKey(item) {
  return `${String(item?.source ?? 'MESSAGE').toUpperCase()}-${item?.id ?? ''}`;
}

export async function getCobrancaLotes(page = 0, size = 20, signal) {
  return request('/api/whatsapp/cobrancas/lotes', { query: { page, size }, signal });
}

export async function getCobrancaLoteDetalhes(loteId, signal) {
  return request(`/api/whatsapp/cobrancas/lote/${encodeURIComponent(loteId)}`, { signal });
}

export async function reenviarCobrancasFalhas(loteId) {
  return request(`/api/whatsapp/cobrancas/reenviar/${encodeURIComponent(loteId)}`, { method: 'POST' });
}

export async function getCobrancaStats(signal) {
  return request('/api/whatsapp/cobrancas/stats', { signal });
}

export async function getCobrancaHistoricoProcesso(processoId, signal) {
  return request(`/api/whatsapp/cobrancas/processo/${encodeURIComponent(processoId)}/historico`, { signal });
}
