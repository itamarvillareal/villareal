const MEDIA_TYPES = ['IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO'];

export function isWhatsAppMediaMessage(message) {
  const type = String(message?.messageType ?? '').toUpperCase();
  return MEDIA_TYPES.includes(type) || Boolean(message?.mediaId);
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
  return isWhatsAppMediaMessage(message) && !message?.mediaDriveUrl;
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
    };
    return {
      ...next,
      mediaProxyUrl: resolverMediaProxyUrl(next),
    };
  });
}
