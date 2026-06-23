import { describe, expect, it } from 'vitest';
import { formatValorMoeda, formatValorMoedaCampo } from './moneyBr.js';

describe('formatValorMoeda', () => {
  it('formata valor da API com ponto decimal (não confunde com milhar)', () => {
    expect(formatValorMoeda('1605.6')).toMatch(/1\.605,60/);
    expect(formatValorMoeda(1605.6)).toMatch(/1\.605,60/);
  });

  it('formata valor BR da planilha', () => {
    expect(formatValorMoeda('1.605,60')).toMatch(/1\.605,60/);
  });
});

describe('formatValorMoedaCampo', () => {
  it('normaliza 1605.6 para campo', () => {
    expect(formatValorMoedaCampo('1605.6')).toBe('1.605,60');
  });

  it('normaliza valor inteiro da API', () => {
    expect(formatValorMoedaCampo('5648')).toBe('5.648,00');
    expect(formatValorMoedaCampo(5648)).toBe('5.648,00');
  });
});
