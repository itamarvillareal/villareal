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
  return normalizarMediaStatus(message) === 'FAILED';
}

/** URL do proxy inline — só quando o Drive já tem o arquivo (senão 404 no backend). */
export function resolverMediaProxyUrl(message) {
  if (!message?.mediaDriveUrl) return null;
  if (message?.mediaProxyUrl) return message.mediaProxyUrl;
  const id = message?.id;
  if (id == null || id === '') return null;
  if (!isWhatsAppMediaMessage(message)) return null;
  return `/api/whatsapp/media/${id}`;
}

export function isWhatsAppMediaPending(message) {
  if (!isWhatsAppMediaMessage(message)) return false;
  if (message?.mediaDriveUrl) return false;
  const st = normalizarMediaStatus(message);
  if (st === 'FAILED' || st === 'DONE') return false;
  return true;
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
    };
    return {
      ...next,
      mediaProxyUrl: resolverMediaProxyUrl(next),
    };
  });
}

/** Atualização otimista após "Tentar novamente". */
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
