import { describe, expect, it } from 'vitest';
import {
  compararPorEntradaEmail,
  compararPorOrdemCaixaGmail,
  ordenarPorEntradaEmail,
  ordenarPorOrdemCaixaGmail,
} from './publicacoesEmailOrdenacao.js';

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

  it('ordena por gmailCaixaOrdem asc (fiel à caixa Gmail)', () => {
    const rows = [
      { id: 1, gmailCaixaOrdem: 3, emailRecebidoEm: '2026-07-12T23:30:02.000Z' },
      { id: 2, gmailCaixaOrdem: 0, emailRecebidoEm: '2026-07-11T15:07:16.000Z' },
      { id: 3, gmailCaixaOrdem: 1, emailRecebidoEm: '2026-07-04T06:02:27.000Z' },
    ];
    const sorted = ordenarPorOrdemCaixaGmail(rows, false);
    expect(sorted.map((r) => r.id)).toEqual([2, 3, 1]);
  });

  it('prioriza gmailCaixaOrdem sobre emailRecebidoEm defasado (thread TRT)', () => {
    const a = {
      id: 1,
      gmailCaixaOrdem: 0,
      emailRecebidoEm: '2026-07-11T15:07:16.000Z',
    };
    const b = {
      id: 2,
      gmailCaixaOrdem: 2,
      emailRecebidoEm: '2026-07-12T23:30:02.000Z',
    };
    expect(compararPorOrdemCaixaGmail(a, b, false)).toBeLessThan(0);
  });
});
