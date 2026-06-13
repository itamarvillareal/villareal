import { describe, expect, it } from 'vitest';
import { buildExtratoUrlParaLancamento, mesAnoFromDataBr } from './extratoDeepLink.js';

describe('extratoDeepLink', () => {
  it('monta URL com banco, mês e id do lançamento', () => {
    expect(mesAnoFromDataBr('18/05/2024')).toBe('2024-05');
    expect(
      buildExtratoUrlParaLancamento({
        lancamentoId: 69421,
        numeroBanco: 26,
        data: '18/05/2024',
      }),
    ).toBe('/financeiro/extrato?lancamento=69421&banco=26&mes=2024-05');
  });

  it('aceita data ISO para o mês', () => {
    expect(
      buildExtratoUrlParaLancamento({
        lancamentoId: 100,
        numeroBanco: 30,
        data: '2024-11-22',
      }),
    ).toBe('/financeiro/extrato?lancamento=100&banco=30&mes=2024-11');
  });
});
