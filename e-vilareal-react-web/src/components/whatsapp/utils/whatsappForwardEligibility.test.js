import { describe, expect, it } from 'vitest';
import { motivoEncaminharIndisponivel, podeEncaminharMensagem } from './whatsappForwardEligibility.js';

describe('whatsappForwardEligibility', () => {
  it('permite texto com id válido', () => {
    expect(podeEncaminharMensagem({ id: 1, messageType: 'TEXT', content: 'oi' })).toBe(true);
  });

  it('bloqueia mídia inbound pendente', () => {
    const msg = { id: 2, messageType: 'IMAGE', direction: 'INBOUND', mediaStatus: 'PENDING' };
    expect(podeEncaminharMensagem(msg)).toBe(false);
    expect(motivoEncaminharIndisponivel(msg)).toContain('download');
  });

  it('permite mídia inbound concluída', () => {
    expect(
      podeEncaminharMensagem({
        id: 3,
        messageType: 'DOCUMENT',
        direction: 'INBOUND',
        mediaStatus: 'DONE',
      }),
    ).toBe(true);
  });

  it('permite mídia outbound', () => {
    expect(
      podeEncaminharMensagem({
        id: 4,
        messageType: 'VIDEO',
        direction: 'OUTBOUND',
        mediaStatus: 'PENDING',
      }),
    ).toBe(true);
  });
});
