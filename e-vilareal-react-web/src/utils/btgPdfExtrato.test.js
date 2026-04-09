import { describe, expect, it } from 'vitest';
import { isInstituicaoBtgExtratoPdf, parseBtgPdfExtratoText, parseValorBtgPdfBr } from './btgPdfExtrato.js';

describe('isInstituicaoBtgExtratoPdf', () => {
  it('identifica contas BTG', () => {
    expect(isInstituicaoBtgExtratoPdf('BTG')).toBe(true);
    expect(isInstituicaoBtgExtratoPdf('BTG Banking')).toBe(true);
    expect(isInstituicaoBtgExtratoPdf('BTG JA')).toBe(true);
    expect(isInstituicaoBtgExtratoPdf('Itaú')).toBe(false);
    expect(isInstituicaoBtgExtratoPdf('CORA')).toBe(false);
  });
});

describe('parseValorBtgPdfBr', () => {
  it('interpreta formato BR com milhares e negativo', () => {
    expect(parseValorBtgPdfBr('49.999,99')).toBe(49999.99);
    expect(parseValorBtgPdfBr('-1.735,36')).toBe(-1735.36);
    expect(parseValorBtgPdfBr('0,00')).toBe(0);
    expect(parseValorBtgPdfBr('1 234 567,89')).toBe(1234567.89);
    expect(parseValorBtgPdfBr('1,234.56')).toBe(1234.56);
  });
});

describe('parseBtgPdfExtratoText', () => {
  it('extrai lançamentos do texto do extrato BTG (modelo compacto: movimento + saldo)', () => {
    const bloco = `
Movimentação - Conta Corrente
Data Descrição Débito Saldo Crédito
Saldo Inicial 0,00
10/03/2026 RECEBIMENTO TRANSFERÊNCIA - Itamar Alexandre 49.999,99	49.999,99
11/03/2026 COMPRA - CDB BANCO BMG S.A - Venc.: 27/09/2027 99.932,66	4.693,25
16/03/2026 TRANSFERÊNCIA A CRÉDITO VIA PIX - ITAMAR 51.000,00	50.000,00
25/03/2026 VENDA DE LFT -1.735,36	93.198,26
`;
    const rows = parseBtgPdfExtratoText(bloco);
    expect(rows.length).toBe(4);
    expect(rows[0].data).toBe('10/03/2026');
    expect(rows[0].descricao).toContain('RECEBIMENTO');
    expect(rows[0].valor).toBe(49999.99);
    expect(rows[0].saldo).toBeCloseTo(49999.99, 2);
    expect(rows[1].valor).toBe(-99932.66);
    expect(rows[1].saldo).toBeCloseTo(49999.99 - 99932.66, 2);
    expect(rows[2].valor).toBe(51000);
    expect(rows[2].saldo).toBeCloseTo(49999.99 - 99932.66 + 51000, 2);
    expect(rows[3].valor).toBe(-1735.36);
    expect(rows[3].saldo).toBeCloseTo(49999.99 - 99932.66 + 51000 - 1735.36, 2);
  });

  it('usa Débito, Crédito e Saldo (PDF) quando há três valores no fim da linha', () => {
    const bloco = `
06/02/2026 ENVIO TRANSFERÊNCIA - Itamar 15.084,48 0,00 57.094,77
07/02/2026 CUPOM - CDB BANCO BMG S.A 0,00 1.901,61 1.901,61
10/02/2026 LIQ BOLSA (Operacoes) 7.881,18 0,00 1.685.686,38
11/02/2026 RECEBIMENTO TRANSFERÊNCIA 0,00 125.000,00 125.000,00
`;
    const rows = parseBtgPdfExtratoText(bloco);
    expect(rows.length).toBe(4);
    const porDesc = (sub) => rows.find((r) => String(r.descricao).includes(sub));
    expect(porDesc('ENVIO TRANSFERÊNCIA')?.valor).toBeCloseTo(-15084.48, 2);
    expect(porDesc('CUPOM')?.valor).toBeCloseTo(1901.61, 2);
    expect(porDesc('LIQ BOLSA')?.valor).toBeCloseTo(-7881.18, 2);
    expect(porDesc('RECEBIMENTO TRANSFERÊNCIA')?.valor).toBeCloseTo(125000, 2);
    let s = 0;
    for (const r of rows) {
      s += r.valor;
      expect(r.saldo).toBeCloseTo(s, 2);
    }
  });

  it('com três valores, ignora saldo do PDF no valor do lançamento (crédito − débito)', () => {
    const bloco = `
01/02/2026 LANCAMENTO TESTE 100,00 0,00 9.999,99
`;
    const rows = parseBtgPdfExtratoText(bloco);
    expect(rows.length).toBe(1);
    expect(rows[0].valor).toBeCloseTo(-100, 2);
    expect(rows[0].saldo).toBeCloseTo(-100, 2);
  });

  it('mescla linha seguinte quando o pdf.js coloca só os valores na linha de baixo', () => {
    const bloco = `
05/01/2026 TED ENVIADA - Itamar Alexandre Felix Villa Real
1.234,56 0,00 5.678,90
06/01/2026 TRANSFERÊNCIA A CRÉDITO VIA PIX - ITAMAR
0,00 2.500,00 8.178,90
`;
    const rows = parseBtgPdfExtratoText(bloco);
    expect(rows.length).toBe(2);
    expect(rows[0].valor).toBeCloseTo(-1234.56, 2);
    expect(rows[1].valor).toBeCloseTo(2500, 2);
    expect(rows[0].descricao).toContain('TED ENVIADA');
    expect(rows[1].descricao).toContain('TRANSFERÊNCIA A CRÉDITO');
  });
});
