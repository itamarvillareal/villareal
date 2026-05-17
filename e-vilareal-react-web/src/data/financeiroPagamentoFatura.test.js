import { describe, expect, it } from 'vitest';
import {
  detectarSugestoesPagamentoFatura,
  lancamentoBancoElegivelPagamentoFatura,
  lancamentoCartaoElegivelPagamentoFatura,
} from './financeiroPagamentoFatura.js';

describe('financeiroPagamentoFatura', () => {
  it('elegibilidade banco e cartão', () => {
    expect(
      lancamentoBancoElegivelPagamentoFatura({
        data: '02/01/2014',
        valor: -100,
        descricao: 'CARTAO PERSONNALITE',
      }),
    ).toBe(true);
    expect(
      lancamentoCartaoElegivelPagamentoFatura({
        data: '11/05/2020',
        valor: 100,
        descricao: 'Pagto Conta Titulos',
      }),
    ).toBe(true);
  });

  it('detecta par por valor e mesma data', () => {
    const sugestoes = detectarSugestoesPagamentoFatura(
      {
        Itaú: [
          {
            apiId: 1,
            numero: 'b1',
            data: '11/05/2020',
            valor: -15000,
            descricao: 'CARTAO PERSONNALITE',
            letra: 'E',
          },
        ],
      },
      {
        Visa: [
          {
            apiId: 2,
            numero: 'c1',
            data: '11/05/2020',
            valor: 15000,
            descricao: 'Pagto Conta Titulos',
          },
        ],
      },
    );
    expect(sugestoes).toHaveLength(1);
    expect(sugestoes[0].banco.apiId).toBe(1);
    expect(sugestoes[0].cartao.apiId).toBe(2);
    expect(sugestoes[0].confianca).toBe('alta');
  });
});
