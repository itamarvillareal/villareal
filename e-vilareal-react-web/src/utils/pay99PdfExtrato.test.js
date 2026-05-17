import { describe, expect, it } from 'vitest';
import {
  isInstituicaoPay99ExtratoPdf,
  parsePay99PdfExtratoText,
} from './pay99PdfExtrato.js';
import { isInstituicaoExtratoPdfImport, parseExtratoPdfText } from './extratoPdfImport.js';

const AMOSTRA = `Data/Hora Descrição Valor
2026-05-17 02:44:10 Lucro +R$ 35,17
2026-05-16 02:22:18 Lucro +R$ 35,16
2026-05-15 18:39:02 Pagamento com Pix recebido +R$ 18.019,55
2026-05-13 10:10:31 Reembolso de depósito no saldo -R$ 52.566,16
2026-05-07 18:09:54 Pagamento com Pix enviado -R$ 56,02

-- 1 of 1 --
`;

describe('isInstituicaoPay99ExtratoPdf', () => {
  it('reconhece 99 Pay', () => {
    expect(isInstituicaoPay99ExtratoPdf('99 Pay')).toBe(true);
    expect(isInstituicaoPay99ExtratoPdf('99  Pay')).toBe(true);
    expect(isInstituicaoPay99ExtratoPdf('Itaú')).toBe(false);
  });
});

describe('parsePay99PdfExtratoText', () => {
  it('extrai créditos e débitos do PDF', () => {
    const rows = parsePay99PdfExtratoText(AMOSTRA);
    expect(rows).toHaveLength(5);
    const lucro17 = rows.find((r) => r.data === '17/05/2026' && r.descricao === 'Lucro');
    expect(lucro17?.valor).toBeCloseTo(35.17, 2);
    const reembolso = rows.find((r) => r.descricao.includes('Reembolso'));
    expect(reembolso?.valor).toBeCloseTo(-52566.16, 2);
    const pix = rows.find((r) => r.descricao.includes('Pix enviado'));
    expect(pix?.valor).toBeCloseTo(-56.02, 2);
  });

  it('integra com extratoPdfImport', () => {
    expect(isInstituicaoExtratoPdfImport('99 Pay')).toBe(true);
    const rows = parseExtratoPdfText(AMOSTRA, '99 Pay');
    expect(rows).toHaveLength(5);
    expect(rows.every((r) => r.letra === 'N')).toBe(true);
  });
});
