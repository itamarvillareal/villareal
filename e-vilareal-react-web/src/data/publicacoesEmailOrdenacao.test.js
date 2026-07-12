import { describe, expect, it } from 'vitest';
import { compararPorEntradaEmail, ordenarPorEntradaEmail } from './publicacoesEmailOrdenacao.js';

describe('publicacoesEmailOrdenacao', () => {
  it('ordena por emailRecebidoEm desc (entrada mais recente primeiro)', () => {
    const rows = [
      { id: 1, emailRecebidoEm: '2026-07-12T10:00:00.000Z', dataPublicacao: '18/02/2026' },
      { id: 2, emailRecebidoEm: '2026-07-12T22:09:00.000Z', dataPublicacao: '13/11/2025' },
      { id: 3, emailRecebidoEm: '2026-07-11T08:00:00.000Z', dataPublicacao: '09/06/2026' },
    ];
    const sorted = ordenarPorEntradaEmail(rows, false);
    expect(sorted.map((r) => r.id)).toEqual([2, 1, 3]);
  });

  it('ignora dataPublicacao quando emailRecebidoEm existe', () => {
    const a = { id: 1, emailRecebidoEm: '2026-07-12T19:00:00.000Z', dataPublicacao: '01/01/2020' };
    const b = { id: 2, emailRecebidoEm: '2026-07-12T20:00:00.000Z', dataPublicacao: '01/01/2025' };
    expect(compararPorEntradaEmail(a, b, false)).toBeGreaterThan(0);
  });
});
