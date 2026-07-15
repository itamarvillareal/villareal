import { describe, expect, it } from 'vitest';
import { mergeMessageStatusUpdate } from './whatsappMessageStatusUtils.js';

describe('mergeMessageStatusUpdate', () => {
  const base = [{ id: 1, waMessageId: 'wamid.abc', status: 'SENT' }];

  it('atualiza status quando waMessageId coincide', () => {
    const result = mergeMessageStatusUpdate(base, { waMessageId: 'wamid.abc', status: 'delivered' });
    expect(result[0].status).toBe('DELIVERED');
  });

  it('não rebaixa READ para DELIVERED', () => {
    const messages = [{ id: 1, waMessageId: 'wamid.abc', status: 'READ' }];
    const result = mergeMessageStatusUpdate(messages, { waMessageId: 'wamid.abc', status: 'delivered' });
    expect(result[0].status).toBe('READ');
  });

  it('permite marcar FAILED mesmo após READ', () => {
    const messages = [{ id: 1, waMessageId: 'wamid.abc', status: 'READ' }];
    const result = mergeMessageStatusUpdate(messages, { waMessageId: 'wamid.abc', status: 'failed' });
    expect(result[0].status).toBe('FAILED');
  });

  it('retorna a mesma referência quando nada muda', () => {
    const result = mergeMessageStatusUpdate(base, { waMessageId: 'wamid.xyz', status: 'read' });
    expect(result).toBe(base);
  });
});
