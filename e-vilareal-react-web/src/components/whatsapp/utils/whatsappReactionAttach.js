import { parseReactionContent } from './whatsappReaction.js';

/** @param {string[]} emojis */
export function distinctReactionEmojis(emojis) {
  const seen = new Set();
  const out = [];
  for (const emoji of emojis) {
    const e = String(emoji ?? '').trim();
    if (!e || seen.has(e)) continue;
    seen.add(e);
    out.push(e);
  }
  return out;
}

/**
 * Anexa reactions às mensagens-alvo carregadas; marca linhas REACTION para suprimir quando grudadas.
 * Reactions cujo alvo não está em `messages` permanecem como linha discreta (fallback).
 *
 * @param {Array<{ id?: number, waMessageId?: string, messageType?: string, content?: string }>} messages
 */
export function enrichMessagesWithReactions(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return [];
  }

  const loadedWaIds = new Set();
  for (const m of messages) {
    const wa = String(m?.waMessageId ?? '').trim();
    if (wa) loadedWaIds.add(wa);
  }

  /** @type {Map<string, string[]>} */
  const rawByTarget = new Map();

  for (const m of messages) {
    if (String(m?.messageType ?? '').toUpperCase() !== 'REACTION') continue;
    const parsed = parseReactionContent(m.content);
    if (!parsed?.emoji || !parsed.targetWaMessageId) continue;
    if (!loadedWaIds.has(parsed.targetWaMessageId)) continue;

    const list = rawByTarget.get(parsed.targetWaMessageId) ?? [];
    list.push(parsed.emoji);
    rawByTarget.set(parsed.targetWaMessageId, list);
  }

  /** @type {Map<string, string[]>} */
  const reactionsByTarget = new Map();
  for (const [waId, emojis] of rawByTarget) {
    reactionsByTarget.set(waId, distinctReactionEmojis(emojis));
  }

  return messages.map((m) => {
    const type = String(m?.messageType ?? '').toUpperCase();
    if (type === 'REACTION') {
      const parsed = parseReactionContent(m.content);
      const canAttach =
        Boolean(parsed?.emoji) &&
        Boolean(parsed.targetWaMessageId) &&
        loadedWaIds.has(parsed.targetWaMessageId);
      return canAttach ? { ...m, _reactionAttachedToTarget: true } : m;
    }

    const wa = String(m?.waMessageId ?? '').trim();
    if (wa && reactionsByTarget.has(wa)) {
      const attachedReactions = reactionsByTarget.get(wa);
      if (attachedReactions?.length) {
        return { ...m, attachedReactions };
      }
    }
    return m;
  });
}
