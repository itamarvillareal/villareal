import { describe, it, expect } from 'vitest';
import {
  isoDataCartao,
  vencimentoFaturaDeLancamento,
  listarVencimentosFaturaCartao,
} from './cartaoFaturaVencimento.js';

describe('cartaoFaturaVencimento', () => {
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
