import { describe, expect, it } from 'vitest';
import {
  aplicarMigracaoValorParcelaTotal,
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

  it('montarLinhasPlanoPagamento grava valor total da parcela em valorParcela', () => {
    const res = montarLinhasPlanoPagamento({
      resumoDebito: { total: '8.948,52', honorarios: '1.491,38' },
      entradaModo: 'nenhuma',
      entradaValor: '',
      entradaPercentual: '',
      dataEntrada: '',
      nParcelas: 1,
      taxaPercent: 1.5,
      dataBaseParcelas: '01/08/2026',
      gerarDataParcela: () => '01/08/2026',
    });
    expect(res.erro).toBeNull();
    expect(res.linhas).toHaveLength(1);
    expect(res.linhas[0].valorParcela).toBe('R$ 9.082,74');
    expect(res.linhas[0].honorariosParcela).toBe('R$ 1.513,75');
    expect(valorTotalLinhaPlanoPagamento(res.linhas[0])).toBe(9082.74);
  });

  it('valorTotalLinhaPlanoPagamento usa coluna Valor (total, honorários não somam)', () => {
    expect(valorTotalLinhaPlanoPagamento({ valorParcela: '9.082,74', honorariosParcela: '1.513,75' })).toBe(9082.74);
  });

  it('calcularResumoPlanoPagamento soma valorParcela (total); honorários são informativos', () => {
    const res = calcularResumoPlanoPagamento(
      [
        { valorParcela: '2.321,64', honorariosParcela: '386,93' },
        { valorParcela: '2.321,64', honorariosParcela: '386,93' },
        { valorParcela: '2.321,64', honorariosParcela: '386,93' },
        { valorParcela: '2.321,64', honorariosParcela: '386,93' },
      ],
      4,
      false
    );
    expect(res.valorFinalParcelas).toBe('R$ 9.286,56');
    expect(res.valorTotalPagar).toBe('R$ 9.286,56');
    expect(res.valorFinalHonorarios).toBe('R$ 1.547,72');
  });

  it('aplicarMigracaoValorParcelaTotal corrige rodadas com valor só principal', () => {
    const geradas = [
      {
        valorParcela: 'R$ 9.082,74',
        honorariosParcela: 'R$ 1.513,75',
        dataVencimento: '01/08/2026',
      },
    ];
    const salvas = [
      {
        valorParcela: 'R$ 7.568,99',
        honorariosParcela: 'R$ 1.513,75',
        dataVencimento: '01/08/2026',
        dataPagamento: '05/08/2026',
      },
    ];
    const migradas = aplicarMigracaoValorParcelaTotal(salvas, geradas);
    expect(migradas[0].valorParcela).toBe('R$ 9.082,74');
    expect(migradas[0].dataPagamento).toBe('05/08/2026');
  });
});
