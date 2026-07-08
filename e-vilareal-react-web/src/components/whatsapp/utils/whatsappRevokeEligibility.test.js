import { describe, expect, it } from 'vitest';
import { podeApagarMensagemParaTodos } from './whatsappRevokeEligibility.js';

describe('podeApagarMensagemParaTodos', () => {
  const agora = Date.now();

  it('permite outbound recente com waMessageId', () => {
    expect(
      podeApagarMensagemParaTodos({
        id: 1,
        direction: 'OUTBOUND',
        waMessageId: 'wamid.test',
        createdAt: new Date(agora - 60_000).toISOString(),
      }),
    ).toBe(true);
  });

  it('bloqueia inbound', () => {
    expect(
      podeApagarMensagemParaTodos({
        id: 1,
        direction: 'INBOUND',
        waMessageId: 'wamid.test',
        createdAt: new Date(agora).toISOString(),
      }),
    ).toBe(false);
  });

  it('bloqueia outbound sem waMessageId', () => {
    expect(
      podeApagarMensagemParaTodos({
        id: 1,
        direction: 'OUTBOUND',
        createdAt: new Date(agora).toISOString(),
      }),
    ).toBe(false);
  });

  it('bloqueia outbound fora da janela de 48h', () => {
    expect(
      podeApagarMensagemParaTodos({
        id: 1,
        direction: 'OUTBOUND',
        waMessageId: 'wamid.test',
        createdAt: new Date(agora - 49 * 60 * 60 * 1000).toISOString(),
      }),
    ).toBe(false);
  });
});
