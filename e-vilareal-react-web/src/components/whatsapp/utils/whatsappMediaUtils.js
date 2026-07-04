const MEDIA_TYPES = ['IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO'];

export function isWhatsAppMediaMessage(message) {
  const type = String(message?.messageType ?? '').toUpperCase();
  return MEDIA_TYPES.includes(type) || Boolean(message?.mediaId);
}

export function normalizarMediaStatus(message) {
  return String(message?.mediaStatus ?? '').toUpperCase();
}

export function isWhatsAppMediaFailed(message) {
  if (!isWhatsAppMediaMessage(message)) return false;
  if (message?.sendFailed) return true;
  return normalizarMediaStatus(message) === 'FAILED';
}

/** URL do proxy inline — só quando o Drive já tem o arquivo (senão 404 no backend). */
export function resolverMediaProxyUrl(message) {
  if (!message?.mediaDriveUrl) return null;
  if (message?.mediaProxyUrl) return message.mediaProxyUrl;
  const id = message?.id;
  if (id == null || id === '') return null;
  if (String(id).startsWith('local-')) return null;
  if (!isWhatsAppMediaMessage(message)) return null;
  return `/api/whatsapp/media/${id}`;
}

export function isWhatsAppMediaPending(message) {
  if (!isWhatsAppMediaMessage(message)) return false;
  if (message?.localPreviewUrl) return false;
  if (message?.sendFailed) return false;
  if (message?.mediaDriveUrl) return false;
  const st = normalizarMediaStatus(message);
  if (st === 'FAILED' || st === 'DONE') return false;
  return true;
}

export function revogarLocalPreviewUrl(message) {
  const url = message?.localPreviewUrl;
  if (url) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  }
}

export function revogarPreviewsLocaisEmLista(messages) {
  if (!Array.isArray(messages)) return;
  messages.forEach((m) => revogarLocalPreviewUrl(m));
}

export function mergeMediaReady(messages, event) {
  if (!event?.mediaDriveUrl) return messages;
  const messageId = event.messageId;
  const waMessageId = event.waMessageId;
  return messages.map((m) => {
    const matches =
      (messageId != null && (m.id === messageId || m.messageId === messageId))
      || (waMessageId && m.waMessageId === waMessageId);
    if (!matches) return m;
    const next = {
      ...m,
      mediaDriveUrl: event.mediaDriveUrl,
      mediaFilename: event.mediaFilename || m.mediaFilename,
      mediaStatus: 'DONE',
      mediaError: null,
      sendFailed: false,
      sendError: null,
      pendingMediaFile: undefined,
    };
    return {
      ...next,
      mediaProxyUrl: resolverMediaProxyUrl(next),
    };
  });
}

/** Reconcilia bolha otimista outbound com resposta de POST /send-media. */
export function reconciliarEnvioMidia(messages, tempId, payload) {
  if (!tempId || !payload) return messages;
  return messages.map((m) => {
    if (m.id !== tempId && m.tempId !== tempId) return m;
    return {
      ...m,
      id: payload.messageId ?? m.id,
      waMessageId: payload.waMessageId ?? m.waMessageId,
      mediaStatus: payload.mediaStatus ?? m.mediaStatus ?? 'PENDING',
      sendFailed: false,
      sendError: null,
    };
  });
}

/** Marca falha de envio outbound; revoga preview local e guarda File para reenvio. */
export function marcarEnvioMidiaFalhou(messages, tempId, errorMessage, pendingMediaFile) {
  if (!tempId) return messages;
  return messages.map((m) => {
    if (m.id !== tempId && m.tempId !== tempId) return m;
    revogarLocalPreviewUrl(m);
    return {
      ...m,
      sendFailed: true,
      sendError: errorMessage || 'Falha ao enviar mídia.',
      pendingMediaFile: pendingMediaFile ?? m.pendingMediaFile,
      localPreviewUrl: undefined,
      status: 'FAILED',
    };
  });
}

/** Remove bolha otimista (ex.: cancelamento). */
export function removerBolhaOtimista(messages, tempId) {
  if (!tempId) return messages;
  return messages.filter((m) => {
    if (m.id !== tempId && m.tempId !== tempId) return true;
    revogarLocalPreviewUrl(m);
    return false;
  });
}

export function consumirLocalPreview(messages, messageId) {
  if (messageId == null) return messages;
  return messages.map((m) => {
    if (m.id !== messageId && m.messageId !== messageId) return m;
    if (!m.localPreviewUrl) return m;
    revogarLocalPreviewUrl(m);
    return { ...m, localPreviewUrl: undefined };
  });
}

/** Atualização otimista após "Tentar novamente" (inbound). */
export function marcarMidiaReprocessando(message) {
  if (!message) return message;
  return {
    ...message,
    mediaStatus: 'PENDING',
    mediaError: null,
    mediaDriveUrl: null,
    mediaProxyUrl: null,
  };
}
