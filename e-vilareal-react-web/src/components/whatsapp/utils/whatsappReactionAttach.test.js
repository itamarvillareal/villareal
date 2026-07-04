import { describe, expect, it } from 'vitest';
import { distinctReactionEmojis, enrichMessagesWithReactions } from './whatsappReactionAttach.js';

describe('distinctReactionEmojis', () => {
  it('mantém ordem e remove duplicatas', () => {
    expect(distinctReactionEmojis(['👍', '❤️', '👍', '👍'])).toEqual(['👍', '❤️']);
  });
});

describe('enrichMessagesWithReactions', () => {
  const target = {
    id: 10,
    waMessageId: 'wamid.TARGET',
    direction: 'OUTBOUND',
    messageType: 'TEXT',
    content: 'Olá',
  };

  function reaction(overrides = {}) {
    return {
      id: 11,
      waMessageId: 'wamid.REACT',
      direction: 'INBOUND',
      messageType: 'REACTION',
      content: JSON.stringify({
        reacao: { emoji: '👍', targetWaMessageId: 'wamid.TARGET' },
      }),
      ...overrides,
    };
  }

  it('anexa emoji ao alvo carregado e suprime linha da reaction', () => {
    const enriched = enrichMessagesWithReactions([target, reaction()]);
    expect(enriched[0].attachedReactions).toEqual(['👍']);
    expect(enriched[1]._reactionAttachedToTarget).toBe(true);
  });

  it('mantém linha discreta quando alvo não está carregado', () => {
    const enriched = enrichMessagesWithReactions([reaction()]);
    expect(enriched[0]._reactionAttachedToTarget).toBeUndefined();
    expect(enriched[0].attachedReactions).toBeUndefined();
  });

  it('não anexa reaction removida (emoji vazio)', () => {
    const removed = reaction({
      content: JSON.stringify({ reacao: { emoji: '', targetWaMessageId: 'wamid.TARGET' } }),
    });
    const enriched = enrichMessagesWithReactions([target, removed]);
    expect(enriched[0].attachedReactions).toBeUndefined();
    expect(enriched[1]._reactionAttachedToTarget).toBeUndefined();
  });

  it('agrupa emojis distintos na mesma mensagem-alvo', () => {
    const r2 = reaction({
      id: 12,
      waMessageId: 'wamid.REACT2',
      content: JSON.stringify({
        reacao: { emoji: '❤️', targetWaMessageId: 'wamid.TARGET' },
      }),
    });
    const r3 = reaction({
      id: 13,
      waMessageId: 'wamid.REACT3',
      content: JSON.stringify({
        reacao: { emoji: '👍', targetWaMessageId: 'wamid.TARGET' },
      }),
    });
    const enriched = enrichMessagesWithReactions([target, r2, r3]);
    expect(enriched[0].attachedReactions).toEqual(['❤️', '👍']);
    expect(enriched[1]._reactionAttachedToTarget).toBe(true);
    expect(enriched[2]._reactionAttachedToTarget).toBe(true);
  });
});
