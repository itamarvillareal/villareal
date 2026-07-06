import { request, postFormData } from '../api/httpClient.js';
import { API_BASE_URL } from '../api/config.js';
import { buildAuditoriaHeaders } from '../services/auditoriaCliente.js';
import { getAccessToken } from '../api/authTokenStorage.js';
import { emitApiUnauthorized } from '../api/apiAuthHeaders.js';

async function parseWhatsAppMediaError(res) {
  const text = await res.text();
  if (!text) return `Erro ${res.status}`;
  try {
    const data = JSON.parse(text);
    return data.message || data.error || text;
  } catch {
    return text.length > 300 ? `${text.slice(0, 300)}…` : text;
  }
}

function headersAuthBlob() {
  const h = { ...buildAuditoriaHeaders() };
  const t = getAccessToken();
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

/**
 * Baixa bytes de mídia WhatsApp via proxy autenticado (GET /api/whatsapp/media/{id}).
 * @param {string} mediaProxyUrl — caminho relativo do DTO (ex.: /api/whatsapp/media/42)
 */
export async function buscarWhatsAppMediaBlob(mediaProxyUrl, opts = {}) {
  const path = String(mediaProxyUrl ?? '').trim();
  if (!path) {
    throw new Error('URL de mídia ausente.');
  }
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: headersAuthBlob(),
    signal: opts.signal,
  });
  if (res.status === 401) emitApiUnauthorized();
  if (!res.ok) {
    throw new Error(await parseWhatsAppMediaError(res));
  }
  return res.blob();
}

/** Dispara reprocessamento manual de mídia inbound (POST /api/whatsapp/media/{id}/reprocessar). */
export async function reprocessarWhatsAppMedia(messageId) {
  const id = messageId != null ? String(messageId).trim() : '';
  if (!id) throw new Error('ID da mensagem ausente.');
  return request(`/api/whatsapp/media/${encodeURIComponent(id)}/reprocessar`, {
    method: 'POST',
  });
}

export async function getWhatsAppStats(signal) {
  return request('/api/whatsapp/stats', { signal });
}

export async function getWhatsAppIaHabilitada(signal) {
  return request('/api/whatsapp/ia/habilitada', { signal });
}

export async function putWhatsAppIaHabilitada(habilitada) {
  return request('/api/whatsapp/ia/habilitada', {
    method: 'PUT',
    body: { habilitada: Boolean(habilitada) },
  });
}

export async function getWhatsAppMessages(phoneNumber, page = 0, size = 20, signal) {
  return request('/api/whatsapp/messages', {
    query: { phoneNumber, page, size },
    signal,
  });
}

export async function searchWhatsAppMessages(phoneNumber, q, signal) {
  return request('/api/whatsapp/messages/search', {
    query: { phoneNumber, q },
    signal,
  });
}

export async function getWhatsAppConversations(page = 0, size = 50, opts = {}) {
  const { arquivadas = false, clienteCodigo, signal } = opts;
  const query = { page, size, arquivadas };
  if (clienteCodigo) query.clienteCodigo = clienteCodigo;
  return request('/api/whatsapp/conversations', {
    query,
    signal,
  });
}

export async function getWhatsAppGrupos(signal) {
  return request('/api/whatsapp/grupos', { signal });
}

export async function getWhatsAppGrupoSugestoesConversas(clienteCodigo, signal) {
  return request(`/api/whatsapp/grupos/${encodeURIComponent(clienteCodigo)}/sugestoes-conversas`, { signal });
}

export async function criarWhatsAppGrupo(clienteCodigo, phoneNumbers, signal) {
  return request('/api/whatsapp/grupos', {
    method: 'POST',
    body: { clienteCodigo, phoneNumbers },
    signal,
  });
}

export async function atualizarWhatsAppGrupo(clienteCodigo, phoneNumbers, signal) {
  return request(`/api/whatsapp/grupos/${encodeURIComponent(clienteCodigo)}`, {
    method: 'PUT',
    body: { phoneNumbers },
    signal,
  });
}

export async function excluirWhatsAppGrupo(clienteCodigo, signal) {
  return request(`/api/whatsapp/grupos/${encodeURIComponent(clienteCodigo)}`, {
    method: 'DELETE',
    signal,
  });
}

export async function getWhatsAppConversationGrupos(phoneNumber, signal) {
  return request(`/api/whatsapp/conversations/${encodeURIComponent(phoneNumber)}/grupos`, { signal });
}

export async function incluirConversaGrupo(phoneNumber, clienteCodigo, signal) {
  return request(
    `/api/whatsapp/conversations/${encodeURIComponent(phoneNumber)}/grupos/${encodeURIComponent(clienteCodigo)}`,
    { method: 'POST', signal },
  );
}

export async function excluirConversaGrupo(phoneNumber, clienteCodigo, signal) {
  return request(
    `/api/whatsapp/conversations/${encodeURIComponent(phoneNumber)}/grupos/${encodeURIComponent(clienteCodigo)}`,
    { method: 'DELETE', signal },
  );
}

export async function getWhatsAppConversationContext(phoneNumber, signal) {
  return request('/api/whatsapp/conversations/context', {
    query: { phoneNumber },
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

export async function sendWhatsAppText(phoneNumber, message, opts = {}) {
  const body = { phoneNumber, message };
  if (opts.clienteId != null) body.clienteId = Number(opts.clienteId);
  if (opts.processoId != null) body.processoId = Number(opts.processoId);
  return request('/api/whatsapp/send', {
    method: 'POST',
    body,
  });
}

/** Envia mídia outbound (multipart). Retorno inclui messageId (DB) e waMessageId. */
export async function sendWhatsAppMedia(phoneNumber, file, caption, opts = {}) {
  if (!file) throw new Error('Arquivo ausente.');
  const fd = new FormData();
  fd.append('phoneNumber', String(phoneNumber ?? '').trim());
  fd.append('arquivo', file, file.name || 'arquivo');
  const cap = String(caption ?? '').trim();
  if (cap) fd.append('caption', cap);
  return postFormData('/api/whatsapp/send-media', fd, opts);
}

export async function sendWhatsAppTemplate(
  phoneNumber,
  templateName,
  languageCode,
  parameters,
  opts = {},
) {
  const body = { phoneNumber, templateName, languageCode, parameters };
  if (opts.clienteId != null) body.clienteId = Number(opts.clienteId);
  if (opts.processoId != null) body.processoId = Number(opts.processoId);
  return request('/api/whatsapp/send-template', {
    method: 'POST',
    body,
  });
}

/** Telefones canônicos de uma pessoa/cliente para iniciar conversa. */
export async function getTelefonesIniciarConversa({ pessoaId, clienteId } = {}, signal) {
  const query = {};
  if (pessoaId != null) query.pessoaId = pessoaId;
  if (clienteId != null) query.clienteId = clienteId;
  return request('/api/whatsapp/iniciar/telefones', { query, signal });
}

/** Janela de 24h da Meta (texto livre vs template). */
export async function getJanelaAberta(phoneNumber, signal) {
  const phone = encodeURIComponent(String(phoneNumber ?? '').trim());
  return request(`/api/whatsapp/conversations/${phone}/janela-aberta`, { signal });
}

export async function createWhatsAppSchedule(data) {
  return request('/api/whatsapp/schedule', {
    method: 'POST',
    body: data,
  });
}

/** Vários agendamentos idênticos em datas distintas (template + params compartilhados). */
export async function createWhatsAppScheduleBatch(data) {
  return request('/api/whatsapp/agendamentos/lote', {
    method: 'POST',
    body: data,
  });
}

/** Preview de datas da recorrência mensal (Brasília). */
export async function previewWhatsAppScheduleRecurrence(recorrenciaMensal, signal) {
  return request('/api/whatsapp/agendamentos/lote/preview-recorrencia', {
    method: 'POST',
    body: recorrenciaMensal,
    signal,
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

/** Marca conversa como lida globalmente (POST 204, idempotente). */
export async function marcarConversaLida(phoneNumber) {
  const phone = String(phoneNumber ?? '').trim();
  if (!phone) throw new Error('Telefone ausente.');
  return request(`/api/whatsapp/conversations/${encodeURIComponent(phone)}/marcar-lida`, {
    method: 'POST',
  });
}

/** Marca várias conversas como lidas (POST, telefones inválidos são pulados no servidor). */
export async function marcarLidasLote(phoneNumbers) {
  const phones = Array.isArray(phoneNumbers)
    ? phoneNumbers.map((p) => String(p ?? '').trim()).filter(Boolean)
    : [];
  return request('/api/whatsapp/conversations/marcar-lida-lote', {
    method: 'POST',
    body: { phones },
  });
}

/** Fixa conversa no topo globalmente (POST 204, idempotente). */
export async function fixarConversa(phoneNumber) {
  const phone = String(phoneNumber ?? '').trim();
  if (!phone) throw new Error('Telefone ausente.');
  return request(`/api/whatsapp/conversations/${encodeURIComponent(phone)}/fixar`, {
    method: 'POST',
  });
}

/** Fixa várias conversas (POST, telefones inválidos são pulados no servidor). */
export async function fixarConversasLote(phoneNumbers) {
  const phones = Array.isArray(phoneNumbers)
    ? phoneNumbers.map((p) => String(p ?? '').trim()).filter(Boolean)
    : [];
  return request('/api/whatsapp/conversations/fixar-lote', {
    method: 'POST',
    body: { phones },
  });
}

/** Remove fixação da conversa (DELETE 204, idempotente). */
export async function desfixarConversa(phoneNumber) {
  const phone = String(phoneNumber ?? '').trim();
  if (!phone) throw new Error('Telefone ausente.');
  return request(`/api/whatsapp/conversations/${encodeURIComponent(phone)}/fixar`, {
    method: 'DELETE',
  });
}

/** Arquiva conversa globalmente (POST 204, idempotente). */
export async function arquivarConversa(phoneNumber) {
  const phone = String(phoneNumber ?? '').trim();
  if (!phone) throw new Error('Telefone ausente.');
  return request(`/api/whatsapp/conversations/${encodeURIComponent(phone)}/arquivar`, {
    method: 'POST',
  });
}

/** Desarquiva conversa globalmente (DELETE 204, idempotente). */
export async function desarquivarConversa(phoneNumber) {
  const phone = String(phoneNumber ?? '').trim();
  if (!phone) throw new Error('Telefone ausente.');
  return request(`/api/whatsapp/conversations/${encodeURIComponent(phone)}/arquivar`, {
    method: 'DELETE',
  });
}

/** Arquiva várias conversas (POST, telefones inválidos são pulados no servidor). */
export async function arquivarConversasLote(phoneNumbers) {
  const phones = Array.isArray(phoneNumbers)
    ? phoneNumbers.map((p) => String(p ?? '').trim()).filter(Boolean)
    : [];
  return request('/api/whatsapp/conversations/arquivar-lote', {
    method: 'POST',
    body: { phones },
  });
}

/** Apaga mensagem da inbox do sistema (soft delete — não remove do WhatsApp do contato). */
export async function apagarMensagem(messageId) {
  const id = messageId != null ? String(messageId).trim() : '';
  if (!id) throw new Error('ID da mensagem ausente.');
  return request(`/api/whatsapp/messages/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** Apaga conversa inteira da inbox do sistema (soft delete das mensagens). */
export async function apagarConversa(phoneNumber) {
  const phone = String(phoneNumber ?? '').trim();
  if (!phone) throw new Error('Telefone ausente.');
  return request(`/api/whatsapp/conversations/${encodeURIComponent(phone)}`, { method: 'DELETE' });
}

/** Define foto manual do contato (POST multipart). Retorna { contactPhotoUrl }. */
export async function definirFotoContato(phoneNumber, file) {
  const phone = String(phoneNumber ?? '').trim();
  if (!phone) throw new Error('Telefone ausente.');
  if (!file) throw new Error('Selecione uma imagem.');
  const form = new FormData();
  form.append('arquivo', file);
  return postFormData(`/api/whatsapp/conversations/${encodeURIComponent(phone)}/photo`, form);
}

/** Remove foto manual do contato. */
export async function removerFotoContato(phoneNumber) {
  const phone = String(phoneNumber ?? '').trim();
  if (!phone) throw new Error('Telefone ausente.');
  return request(`/api/whatsapp/conversations/${encodeURIComponent(phone)}/photo`, { method: 'DELETE' });
}

/** Número de conversas com INBOUND não lida (leitura interna global). */
export async function getUnreadTotal(signal) {
  return request('/api/whatsapp/conversations/unread-total', { signal });
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
