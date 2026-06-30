const MEDIA_TYPES = ['IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO'];

export function isWhatsAppMediaMessage(message) {
  const type = String(message?.messageType ?? '').toUpperCase();
  return MEDIA_TYPES.includes(type) || Boolean(message?.mediaId);
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
    return {
      ...m,
      mediaDriveUrl: event.mediaDriveUrl,
      mediaFilename: event.mediaFilename || m.mediaFilename,
    };
  });
}
