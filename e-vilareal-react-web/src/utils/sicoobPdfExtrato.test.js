import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PDFParse } from 'pdf-parse';
import {
  isInstituicaoSicoobExtratoPdf,
  parseSicoobPdfExtratoText,
} from './sicoobPdfExtrato.js';
import { isInstituicaoExtratoPdfImport, parseExtratoPdfText } from './extratoPdfImport.js';

const PDF_FIXTURE =
  '/Users/itamar/Downloads/comprovante_16-05-2026 20-14-23.pdf';

describe('isInstituicaoSicoobExtratoPdf', () => {
  it('identifica contas Sicoob', () => {
    expect(isInstituicaoSicoobExtratoPdf('Sicoob')).toBe(true);
    expect(isInstituicaoSicoobExtratoPdf('Sicoob VRV')).toBe(true);
    expect(isInstituicaoSicoobExtratoPdf('BTG')).toBe(false);
  });
});

describe('parseSicoobPdfExtratoText', () => {
  const amostra = `
PERÍODO: 01/04/2026 - 30/04/2026
HISTÓRICO DE MOVIMENTAÇÃO
DATA 	HISTÓRICO 	VALOR
24/03 	SALDO ANTERIOR 	0,00C
06/04 	DÉB.CONV.DEM.EMPRES 	987,72D
DOC.: CONSÓRCIOS
06/04 	PIX REC.OUTRA IF MT 	987,72C
Recebimento Pix
DOC.: Pix
09/04 	PIX REC.OUTRA IF MT 	1.000,02C
09/04 	SAQ S/ CARTÃO 	1.000,00D
RESUMO
(+) SALDO EM CONTA: 	0,00C
`;

  it('ignora saldos e extrai movimentos com C/D', () => {
    const rows = parseSicoobPdfExtratoText(amostra);
    expect(rows.length).toBe(4);
    const deb = rows.find((r) => r.descricao.includes('DÉB.CONV'));
    expect(deb?.data).toBe('06/04/2026');
    expect(deb?.valor).toBeCloseTo(-987.72, 2);
    expect(rows.some((r) => r.valor === 987.72)).toBe(true);
    expect(rows.some((r) => r.valor === 1000.02)).toBe(true);
    expect(rows.some((r) => r.valor === -1000)).toBe(true);
    expect(rows.every((r) => r.origemImportacao === 'PDF')).toBe(true);
  });

  it('roteia via extratoPdfImport para Sicoob', () => {
    const rows = parseExtratoPdfText(amostra, 'Sicoob');
    expect(rows.length).toBe(4);
    expect(isInstituicaoExtratoPdfImport('Sicoob VRV')).toBe(true);
  });
});

describe('PDF real Sicoob (fixture utilizador)', () => {
  it('extrai lançamentos do comprovante anexo', async () => {
    let texto;
    try {
      const buf = readFileSync(PDF_FIXTURE);
      const r = await new PDFParse({ data: buf }).getText();
      texto = r.text;
    } catch {
      return;
    }
    const rows = parseSicoobPdfExtratoText(texto);
    expect(rows.length).toBeGreaterThanOrEqual(15);
    const deb = rows.find((r) => String(r.descricao).includes('DÉB.CONV'));
    expect(deb?.valor).toBeLessThan(0);
    const pix = rows.filter((r) => /PIX/i.test(r.descricao));
    expect(pix.length).toBeGreaterThanOrEqual(3);
    expect(rows.every((r) => /^\d{2}\/\d{2}\/2026$/.test(r.data))).toBe(true);
  });
});
