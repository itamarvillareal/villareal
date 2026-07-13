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

  it('desempata pelo id Gmail quando emailRecebidoEm é igual', () => {
    const a = {
      id: 1,
      emailRecebidoEm: '2026-07-12T18:50:01.000Z',
      arquivoOrigem: 'Assunto [aaa111]',
    };
    const b = {
      id: 2,
      emailRecebidoEm: '2026-07-12T18:50:01.000Z',
      arquivoOrigem: 'Assunto [bbb222]',
    };
    expect(compararPorEntradaEmail(a, b, false)).toBeGreaterThan(0);
  });

  it('prioriza createdAt quando emailRecebidoEm do Gmail está defasado (thread TRT)', () => {
    const rows = [
      {
        id: 1,
        emailRecebidoEm: '2026-07-11T15:07:16.000Z',
        createdAt: '2026-07-13T01:38:34.166Z',
        arquivoOrigem: 'TRT [19f58d33]',
      },
      {
        id: 2,
        emailRecebidoEm: '2026-07-12T07:36:10.000Z',
        createdAt: '2026-07-13T01:29:45.762Z',
        arquivoOrigem: 'TRT [19f57e99]',
      },
    ];
    const sorted = ordenarPorEntradaEmail(rows, false);
    expect(sorted.map((r) => r.id)).toEqual([1, 2]);
  });
});
