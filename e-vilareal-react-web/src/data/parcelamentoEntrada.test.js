import { describe, expect, it } from 'vitest';
import {
  calcularEntradaCentavos,
  calcularParcelaPrecoMensalPrice,
  calcularResumoPlanoPagamento,
  montarLinhasPlanoPagamento,
  rateioEntradaESaldos,
  temPlanoPagamento,
  valorTotalLinhaPlanoPagamento,
} from './parcelamentoEntrada.js';

describe('parcelamentoEntrada', () => {
  it('rateio proporcional da entrada', () => {
    const r = rateioEntradaESaldos(1_043_988, 149_136, 200_000);
    expect(r.entradaHonorariosCentavos + r.entradaPrincipalCentavos).toBe(200_000);
    expect(r.saldoPrincipalCentavos + r.saldoHonorariosCentavos).toBe(1_043_988 - 200_000);
  });

  it('entrada em % sobre débito total', () => {
    const { entradaCentavos } = calcularEntradaCentavos({
      modo: 'percentual',
      percentualStr: '10',
      debitoTotalCentavos: 1_000_000,
    });
    expect(entradaCentavos).toBe(100_000);
  });

  it('bloqueia entrada R$ >= débito', () => {
    const r = calcularEntradaCentavos({
      modo: 'reais',
      valorReaisStr: '10.000,00',
      debitoTotalCentavos: 500_000,
    });
    expect(r.erro).toBeTruthy();
    expect(r.entradaCentavos).toBe(0);
  });

  it('monta entrada + parcelas Price', () => {
    const res = montarLinhasPlanoPagamento({
      resumoDebito: { total: '10.439,88', honorarios: '1.491,36' },
      entradaModo: 'reais',
      entradaValor: '1.000,00',
      entradaPercentual: '',
      dataEntrada: '01/08/2026',
      nParcelas: 3,
      taxaPercent: 0,
      dataBaseParcelas: '01/08/2026',
      gerarDataParcela: (_base, i) => `0${i + 2}/09/2026`,
    });
    expect(res.erro).toBeNull();
    expect(res.linhas).toHaveLength(4);
    expect(res.linhas[0].tipo).toBe('entrada');
    expect(res.linhas[0].valorParcela).toBeTruthy();
    expect(res.linhas[1].tipo).toBe('parcela');
    expect(res.linhas[1].valorParcela).toBeTruthy();
    expect(res.saldoCentavos).toBeGreaterThan(0);
  });

  it('temPlanoPagamento detecta entrada ou parcelas', () => {
    expect(temPlanoPagamento({ entradaParcelamentoModo: 'reais', quantidadeParcelasInformada: '00' })).toBe(true);
    expect(
      temPlanoPagamento({
        quantidadeParcelasInformada: '02',
        parcelas: [{ valorParcela: '100,00', honorariosParcela: '' }, { valorParcela: '100,00' }],
      })
    ).toBe(true);
    expect(temPlanoPagamento({ quantidadeParcelasInformada: '00' })).toBe(false);
  });

  it('valorTotalLinhaPlanoPagamento usa só coluna Valor (honorários não somam)', () => {
    expect(valorTotalLinhaPlanoPagamento({ valorParcela: '1.934,71', honorariosParcela: '386,93' })).toBe(1934.71);
  });

  it('calcularResumoPlanoPagamento soma só valorParcela; honorários são informativos', () => {
    const res = calcularResumoPlanoPagamento(
      [
        { valorParcela: '1.934,71', honorariosParcela: '386,93' },
        { valorParcela: '1.934,71', honorariosParcela: '386,93' },
        { valorParcela: '1.934,71', honorariosParcela: '386,93' },
        { valorParcela: '1.934,71', honorariosParcela: '386,93' },
      ],
      4,
      false
    );
    expect(res.valorFinalParcelasPrincipal).toBe('R$ 7.738,84');
    expect(res.valorFinalParcelas).toBe('R$ 7.738,84');
    expect(res.valorTotalPagar).toBe('R$ 7.738,84');
    expect(res.valorFinalHonorarios).toBe('R$ 1.547,72');
  });
});
