import { describe, expect, it } from 'vitest';
import {
  isInstituicaoPay99ExtratoPdf,
  parsePay99PdfExtratoText,
} from './pay99PdfExtrato.js';
import { isInstituicaoExtratoPdfImport, parseExtratoPdfText } from './extratoPdfImport.js';

const AMOSTRA_LINHA_UNICA = `Data/Hora Descrição Valor
2026-05-17 02:44:10 Lucro +R$ 35,17
2026-05-16 02:22:18 Lucro +R$ 35,16
2026-05-15 18:39:02 Pagamento com Pix recebido +R$ 18.019,55
2026-05-13 10:10:31 Reembolso de depósito no saldo -R$ 52.566,16
2026-05-07 18:09:54 Pagamento com Pix enviado -R$ 56,02

-- 1 of 1 --
`;

const AMOSTRA_BLOCO_DATA = `Extrato
Filtro: Todas as transações • Período: 15/05/2026 a 01/07/2026 • Moeda: BRL (R$)
Maio de 2026
Data e hora Descrição Valor Reembolso
2026-05-15
18:39:02 Pagamento com Pix recebido +R$18.019,55
Parcialmente
reembolsado
(R$18.019,53)
2026-05-16
02:22:18 Lucro +R$35,16 —
2026-05-17
02:44:10 Lucro +R$35,17 —
`;

const AMOSTRA_MULTILINHA = `2026-05-15
18:39:02
Pagamento com Pix recebido
+R$18.019,55
2026-05-16
02:22:18
Lucro
+R$35,16
—
`;

const AMOSTRA_TABELA = `Nº Data Hora Descrição
1 04/11/2025 22:24:49 Pagamento recebido
2 05/11/2025 22:15:56 Pagamento recebido
3 06/11/2025 03:52:47 Lucros
Valor ID Transação
+R$2.418,40 9223372036854775735
+R$28.285,73 9223372036854775737
+R$12,32 9223372036854775738
`;

describe('isInstituicaoPay99ExtratoPdf', () => {
  it('reconhece 99 Pay', () => {
    expect(isInstituicaoPay99ExtratoPdf('99 Pay')).toBe(true);
    expect(isInstituicaoPay99ExtratoPdf('99  Pay')).toBe(true);
    expect(isInstituicaoPay99ExtratoPdf('Itaú')).toBe(false);
  });
});

describe('parsePay99PdfExtratoText', () => {
  it('extrai créditos e débitos do layout linha única', () => {
    const rows = parsePay99PdfExtratoText(AMOSTRA_LINHA_UNICA);
    expect(rows).toHaveLength(5);
    const lucro17 = rows.find((r) => r.data === '17/05/2026' && r.descricao === 'Lucro');
    expect(lucro17?.valor).toBeCloseTo(35.17, 2);
    const reembolso = rows.find((r) => r.descricao.includes('Reembolso'));
    expect(reembolso?.valor).toBeCloseTo(-52566.16, 2);
    const pix = rows.find((r) => r.descricao.includes('Pix enviado'));
    expect(pix?.valor).toBeCloseTo(-56.02, 2);
  });

  it('extrai exportação com data em linha separada (pdf-parse)', () => {
    const rows = parsePay99PdfExtratoText(AMOSTRA_BLOCO_DATA);
    expect(rows).toHaveLength(3);
    expect(rows.find((r) => r.data === '15/05/2026')?.valor).toBeCloseTo(18019.55, 2);
    expect(rows.filter((r) => r.descricao === 'Lucro')).toHaveLength(2);
  });

  it('extrai exportação multilinha (pdf.js)', () => {
    const rows = parsePay99PdfExtratoText(AMOSTRA_MULTILINHA);
    expect(rows).toHaveLength(2);
    expect(rows[0].valor).toBeCloseTo(18019.55, 2);
    expect(rows[1].valor).toBeCloseTo(35.16, 2);
  });

  it('pareia tabela Nº/Data/Hora com bloco de valores', () => {
    const rows = parsePay99PdfExtratoText(AMOSTRA_TABELA);
    expect(rows).toHaveLength(3);
    expect(rows[0].valor).toBeCloseTo(2418.4, 2);
    expect(rows[2].descricao).toBe('Lucros');
  });

  it('integra com extratoPdfImport', () => {
    expect(isInstituicaoExtratoPdfImport('99 Pay')).toBe(true);
    const rows = parseExtratoPdfText(AMOSTRA_LINHA_UNICA, '99 Pay');
    expect(rows).toHaveLength(5);
    expect(rows.every((r) => r.letra === 'N')).toBe(true);
  });
});
