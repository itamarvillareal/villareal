import { describe, expect, it } from 'vitest';
import { contaCodigoExtratoExibicao, descricaoIndicaContaF } from './financeiroDescricaoContaF.js';

describe('descricaoIndicaContaF', () => {
  it('detecta COR JURS e CRI', () => {
    expect(descricaoIndicaContaF('COR JURS CRI Brookfield', '')).toBe(true);
    expect(descricaoIndicaContaF('COR JURS CRI ALIANSCE', '')).toBe(true);
  });

  it('detecta JUROS, LCA e CDB', () => {
    expect(descricaoIndicaContaF('JUROS POUPANCA', '')).toBe(true);
    expect(descricaoIndicaContaF('RESGATE LCA BANCO', '')).toBe(true);
    expect(descricaoIndicaContaF('COMPRA CDB BMG', '')).toBe(true);
  });

  it('ignora descrições comuns sem rendimento', () => {
    expect(descricaoIndicaContaF('PIX TRANSF Itamar', '')).toBe(false);
  });
});

describe('contaCodigoExtratoExibicao', () => {
  it('mostra F sugerida para importado em N com COR JURS', () => {
    expect(
      contaCodigoExtratoExibicao({
        contaCodigo: 'N',
        etapa: 'IMPORTADO',
        descricao: 'COR JURS CRI Brookfield',
      }),
    ).toBe('F');
  });

  it('mantém conta já classificada', () => {
    expect(
      contaCodigoExtratoExibicao({
        contaCodigo: 'N',
        etapa: 'IMPORTADO',
        descricao: 'PIX TRANSF',
      }),
    ).toBe('N');
  });
});
