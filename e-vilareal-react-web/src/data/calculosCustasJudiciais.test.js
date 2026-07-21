import { describe, expect, it } from 'vitest';
import {
  calcularResumoCustasGrade,
  calcularTotalLinhaCustas,
  calcularValorCustasParcelaLegado,
  custasGradeTemValor,
} from './calculosCustasJudiciais.js';

describe('calculosCustasJudiciais', () => {
  it('detecta custas cadastradas', () => {
    expect(custasGradeTemValor([{ valor: '', dataPagamento: '' }])).toBe(false);
    expect(custasGradeTemValor([{ valor: 'R$ 100,00', dataPagamento: '01/01/2024' }])).toBe(true);
  });

  it('soma total da linha (valor + atualização + juros)', () => {
    const row = calcularTotalLinhaCustas({
      valor: 'R$ 1.000,00',
      atualizacaoMonetaria: 'R$ 50,00',
      juros: 'R$ 10,00',
    });
    expect(row.total).toBe('R$ 1.060,00');
  });

  it('resume grade com quantidade e totais', () => {
    const res = calcularResumoCustasGrade([
      { valor: 'R$ 500,00', atualizacaoMonetaria: 'R$ 20,00', juros: 'R$ 5,00' },
      { valor: 'R$ 300,00', atualizacaoMonetaria: 'R$ 10,00', juros: 'R$ 2,00' },
      { valor: '', atualizacaoMonetaria: '', juros: '' },
    ]);
    expect(res.qtd).toBe('02 custas');
    expect(res.total).toBe('R$ 837,00');
  });

  it('calcula valor de custas por parcela (legado)', () => {
    const v = calcularValorCustasParcelaLegado(200, 800, 500, 2);
    expect(v).toBeGreaterThan(0);
  });
});
