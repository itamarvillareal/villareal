import { describe, it, expect } from 'vitest';
import {
  isoDataCartao,
  vencimentoFaturaDeLancamento,
  listarVencimentosFaturaCartao,
  ehLancamentoFechamentoAutomatico,
  dataCompraCartaoCorrigida,
  inferirAnoCompraFaturaCartao,
} from './cartaoFaturaVencimento.js';

describe('cartaoFaturaVencimento', () => {
  it('inferirAnoCompraFaturaCartao trata dezembro na fatura de janeiro', () => {
    expect(inferirAnoCompraFaturaCartao(30, 12, 1, 2026)).toBe(2025);
    expect(inferirAnoCompraFaturaCartao(27, 3, 4, 2026)).toBe(2026);
  });

  it('corrige compra gravada com ano errado pelo vencimento da fatura', () => {
    expect(
      dataCompraCartaoCorrigida({
        dataLancamento: '2026-12-30',
        dataCompetencia: '2026-01-10',
        origem: 'FATURA_XLSX_BTG',
      }),
    ).toBe('2025-12-30');
  });

  it('normaliza ISO e BR', () => {
    expect(isoDataCartao('2025-07-10')).toBe('2025-07-10');
    expect(isoDataCartao('10/07/2025')).toBe('2025-07-10');
  });

  it('ignora competência igual à data da compra (legado planilha)', () => {
    expect(
      vencimentoFaturaDeLancamento({
        dataLancamento: '2025-06-06',
        dataCompetencia: '2025-06-06',
        origem: 'PLANILHA',
      }),
    ).toBe('');
  });

  it('usa competência de importação de fatura como vencimento único', () => {
    expect(
      vencimentoFaturaDeLancamento({
        dataLancamento: '2025-06-06',
        dataCompetencia: '2025-07-10',
        origem: 'FATURA_XLSX',
      }),
    ).toBe('2025-07-10');
  });

  it('AUTO-FAT usa competência como vencimento mesmo com data igual', () => {
    expect(
      vencimentoFaturaDeLancamento({
        dataLancamento: '2025-07-10',
        dataCompetencia: '2025-07-10',
        origem: 'AUTO',
        numeroLancamento: 'AUTO-FAT-8-2025-07-10',
        valor: -1500,
      }),
    ).toBe('2025-07-10');
  });

  it('identifica AUTO-FAT', () => {
    expect(
      ehLancamentoFechamentoAutomatico({
        numeroLancamento: 'AUTO-FAT-20-2025-07-01',
        origem: 'AUTO',
      }),
    ).toBe(true);
    expect(
      ehLancamentoFechamentoAutomatico({
        numeroLancamento: '123',
        origem: 'FATURA_XLSX_BTG',
      }),
    ).toBe(false);
  });

  it('ignora AUTO-FAT no total do dropdown de vencimentos', () => {
    const rows = [
      { dataLancamento: '2025-06-01', dataCompetencia: '2025-07-10', origem: 'FATURA_XLSX', valor: 100 },
      {
        dataLancamento: '2025-07-10',
        dataCompetencia: '2025-07-10',
        origem: 'AUTO',
        numeroLancamento: 'AUTO-FAT-8-2025-07-10',
        valor: -100,
      },
    ];
    const venc = listarVencimentosFaturaCartao(rows);
    expect(venc).toHaveLength(1);
    expect(venc[0].total).toBe(100);
    expect(venc[0].count).toBe(1);
  });

  it('agrupa lançamentos pela data de vencimento da fatura', () => {
    const rows = [
      { dataLancamento: '2025-06-01', dataCompetencia: '2025-07-10', origem: 'FATURA_XLSX', valor: 100 },
      { dataLancamento: '2025-06-05', dataCompetencia: '2025-07-10', origem: 'FATURA_XLSX', valor: 50 },
      { dataLancamento: '2025-05-01', dataCompetencia: '2025-05-01', origem: 'PLANILHA', valor: 20 },
    ];
    const venc = listarVencimentosFaturaCartao(rows);
    expect(venc).toHaveLength(1);
    expect(venc[0].iso).toBe('2025-07-10');
    expect(venc[0].count).toBe(2);
    expect(venc[0].total).toBe(150);
  });
});
