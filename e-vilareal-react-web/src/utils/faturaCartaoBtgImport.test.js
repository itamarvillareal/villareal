import { describe, expect, it } from 'vitest';
import {
  parseMatrixFaturaBtg,
  planilhaPareceFaturaBtg,
  parseDataFaturaBtgCelula,
  parseDataCelulaFaturaBtg,
  ehLinhaPagamentoFaturaBtg,
} from './faturaCartaoBtgImport.js';

const MATRIX_MINIMA = [
  ['Fatura Cartão de Crédito', '', '', '', '', 'Abril/2026', ''],
  ['Vencimento', '', '01/04', '', 'Total da Fatura', '', 100],
  ['Data', 'Descrição', '', 'Valor'],
  [new Date(2026, 2, 2), 'Pagamento de fatura', '', -50],
  ['Data', 'Descrição', '', 'Valor', 'Tipo de compra', 'Código de autorização', 'Final Cartão'],
  [new Date(2026, 2, 10), 'Loja Teste', '', 100, 'Compra à vista', 'ABC', '1234'],
];

describe('faturaCartaoBtgImport', () => {
  it('reconhece planilha BTG', () => {
    expect(planilhaPareceFaturaBtg(MATRIX_MINIMA)).toBe(true);
  });

  it('ignora pagamento de fatura', () => {
    expect(ehLinhaPagamentoFaturaBtg('Pagamento de fatura')).toBe(true);
    const { rows, meta } = parseMatrixFaturaBtg(MATRIX_MINIMA, { ignorarPagamento: true });
    expect(rows).toHaveLength(1);
    expect(rows[0].descricao).toBe('Loja Teste');
    expect(meta.ignoradosPagamento).toBe(1);
    expect(meta.dataVencimento).toBe('2026-04-01');
  });

  it('infere ano em data dd/mm sem ano', () => {
    expect(parseDataFaturaBtgCelula('27/03', { mesVencimento: 4, anoVencimento: 2026 })).toBe('2026-03-27');
    expect(parseDataFaturaBtgCelula('22/05', { mesVencimento: 4, anoVencimento: 2026 })).toBe('2025-05-22');
    expect(parseDataFaturaBtgCelula('30/12', { mesVencimento: 1, anoVencimento: 2026 })).toBe('2025-12-30');
  });

  it('corrige ano em célula Date do Excel (dd/mm sem ano na fatura)', () => {
    expect(
      parseDataCelulaFaturaBtg(new Date(2026, 11, 30), { mesVencimento: 1, anoVencimento: 2026 }),
    ).toBe('2025-12-30');
  });
});
