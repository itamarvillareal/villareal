import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatBubble } from './ChatBubble.jsx';

vi.mock('../hooks/useWhatsAppMediaUrl.js', () => ({
  useWhatsAppMediaUrl: () => ({ url: null, blob: null, loading: false, error: null }),
}));

describe('ChatBubble reactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mensagem REACTION grudada não renderiza linha discreta', () => {
    const html = renderToStaticMarkup(
      createElement(ChatBubble, {
        message: {
          id: 2,
          messageType: 'REACTION',
          content: JSON.stringify({
            reacao: { emoji: '👍', targetWaMessageId: 'wamid.TARGET' },
          }),
          _reactionAttachedToTarget: true,
        },
      }),
    );
    expect(html).toBe('');
  });

  it('mensagem REACTION sem alvo carregado mantém linha discreta', () => {
    const html = renderToStaticMarkup(
      createElement(ChatBubble, {
        message: {
          id: 2,
          messageType: 'REACTION',
          content: JSON.stringify({
            reacao: { emoji: '👍', targetWaMessageId: 'wamid.AUSENTE' },
          }),
        },
      }),
    );
    expect(html).toContain('Cliente reagiu');
    expect(html).toContain('👍');
  });

  it('bolha com attachedReactions mostra badge', () => {
    const html = renderToStaticMarkup(
      createElement(ChatBubble, {
        message: {
          id: 1,
          direction: 'OUTBOUND',
          messageType: 'TEXT',
          content: 'Olá',
          attachedReactions: ['👍', '❤️'],
        },
      }),
    );
    expect(html).toContain('Reações:');
    expect(html).toContain('👍');
    expect(html).toContain('❤️');
  });

  it('bolha sem reaction não mostra badge', () => {
    const html = renderToStaticMarkup(
      createElement(ChatBubble, {
        message: {
          id: 1,
          direction: 'OUTBOUND',
          messageType: 'TEXT',
          content: 'Olá',
        },
      }),
    );
    expect(html).not.toContain('Reações:');
  });
});
