const REVOKE_WINDOW_MS = 48 * 60 * 60 * 1000;

/** Mensagem outbound enviada pelo escritório e ainda dentro da janela de revogação (~48h). */
export function podeApagarMensagemParaTodos(message) {
  if (!message || typeof message.id !== 'number' || message.id <= 0) return false;
  if (String(message.direction ?? '').toUpperCase() !== 'OUTBOUND') return false;
  if (!String(message.waMessageId ?? '').trim()) return false;
  const createdAt = message.createdAt ? new Date(message.createdAt).getTime() : NaN;
  if (!Number.isFinite(createdAt)) return false;
  return Date.now() - createdAt <= REVOKE_WINDOW_MS;
}
