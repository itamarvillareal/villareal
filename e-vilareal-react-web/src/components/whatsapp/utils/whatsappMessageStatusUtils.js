const STATUS_RANK = {
  PENDING: 0,
  SENT: 1,
  DELIVERED: 2,
  READ: 3,
  FAILED: 99,
};

/**
 * Aplica atualização de status de entrega (webhook Meta → SSE) à lista de mensagens em memória.
 * Evita rebaixar status (ex.: READ → DELIVERED), exceto para FAILED.
 *
 * @param {Array<{ waMessageId?: string, status?: string }>} messages
 * @param {{ waMessageId?: string, status?: string }} update
 */
export function mergeMessageStatusUpdate(messages, update) {
  const waMessageId = String(update?.waMessageId ?? '').trim();
  const nextStatus = String(update?.status ?? '').trim().toUpperCase();
  if (!waMessageId || !nextStatus || !Array.isArray(messages)) return messages;

  let changed = false;
  const result = messages.map((message) => {
    if (String(message?.waMessageId ?? '').trim() !== waMessageId) return message;

    const currentStatus = String(message?.status ?? '').trim().toUpperCase();
    if (currentStatus === nextStatus) return message;

    if (nextStatus !== 'FAILED') {
      const currentRank = STATUS_RANK[currentStatus];
      const nextRank = STATUS_RANK[nextStatus];
      if (
        Number.isFinite(currentRank) &&
        Number.isFinite(nextRank) &&
        nextRank < currentRank
      ) {
        return message;
      }
    }

    changed = true;
    return { ...message, status: nextStatus };
  });

  return changed ? result : messages;
}
