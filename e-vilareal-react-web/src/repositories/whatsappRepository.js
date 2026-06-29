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

export async function deleteWhatsAppTemplate(name) {
  return request(`/api/whatsapp/templates/${encodeURIComponent(name)}`, { method: 'DELETE' });
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
