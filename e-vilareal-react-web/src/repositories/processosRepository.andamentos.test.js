import { describe, expect, it } from 'vitest';
import { assinaturaAndamento } from './processosRepository.js';

describe('assinaturaAndamento', () => {
  it('iguala data local T12:00:00 com Instant da API no mesmo dia', () => {
    const daUi = { movimentoEm: '2026-04-20T12:00:00', titulo: 'JUNTEI IMPUGNAÇÃO' };
    const daApi = { movimentoEm: '2026-04-20T15:00:00.000Z', titulo: 'JUNTEI IMPUGNAÇÃO' };
    expect(assinaturaAndamento(daUi)).toBe(assinaturaAndamento(daApi));
  });

  it('aceita movimento_em e campo info (shape do histórico na UI)', () => {
    const api = { movimento_em: '2026-03-03T03:00:00.000Z', titulo: 'DECISÃO' };
    const ui = { movimentoEm: '2026-03-03T12:00:00', info: 'DECISÃO' };
    expect(assinaturaAndamento(api)).toBe(assinaturaAndamento(ui));
  });
});
