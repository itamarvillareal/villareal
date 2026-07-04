/**
 * @typedef {{ emoji: string, targetWaMessageId?: string }} ReacaoWhatsApp
 */

/**
 * @param {string|undefined|null} content
 * @returns {ReacaoWhatsApp|null}
 */
export function parseReactionContent(content) {
  const raw = String(content ?? '').trim();
  if (!raw.startsWith('{')) return null;
  try {
    const data = JSON.parse(raw);
    const reacao = data?.reacao ?? data?.reaction;
    if (!reacao || typeof reacao !== 'object') return null;
    const emoji = String(reacao.emoji ?? '').trim();
    if (!emoji) return null;
    const targetWaMessageId = String(reacao.targetWaMessageId ?? reacao.message_id ?? '').trim();
    return {
      emoji,
      targetWaMessageId: targetWaMessageId || undefined,
    };
  } catch {
    return null;
  }
}

/**
 * @param {string|undefined|null} content
 * @returns {string}
 */
export function resumoReactionContent(content) {
  const parsed = parseReactionContent(content);
  if (!parsed?.emoji) return 'Reação';
  return `Reagiu ${parsed.emoji}`;
}

/**
 * Texto da linha discreta na thread (abordagem a).
 * @param {string|undefined|null} content
 * @returns {string}
 */
export function labelReactionThread(content) {
  const parsed = parseReactionContent(content);
  if (!parsed?.emoji) return 'Reação';
  return `Cliente reagiu ${parsed.emoji} à sua mensagem`;
}
