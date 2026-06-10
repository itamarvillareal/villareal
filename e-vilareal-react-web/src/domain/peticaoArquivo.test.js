import { describe, expect, it } from 'vitest';
import { isArquivoP7s, isArquivoPdfSemAssinatura, separarArquivosP7s } from './peticaoArquivo.js';

function file(name, type = '') {
  return /** @type {File} */ ({ name, type });
}

describe('peticaoArquivo', () => {
  it('trata .p7s e .pdf.p7s como assinados', () => {
    expect(isArquivoP7s(file('doc.p7s'))).toBe(true);
    expect(isArquivoP7s(file('peticao.pdf.p7s'))).toBe(true);
    expect(isArquivoPdfSemAssinatura(file('peticao.pdf.p7s'))).toBe(false);
  });

  it('PDF sem assinatura não é p7s', () => {
    expect(isArquivoPdfSemAssinatura(file('peticao.pdf', 'application/pdf'))).toBe(true);
    expect(isArquivoP7s(file('peticao.pdf', 'application/pdf'))).toBe(false);
  });

  it('separarArquivosP7s rejeita PDF', () => {
    const { validos, invalidos } = separarArquivosP7s([
      file('a.pdf.p7s'),
      file('b.pdf'),
    ]);
    expect(validos).toHaveLength(1);
    expect(invalidos).toHaveLength(1);
  });
});
