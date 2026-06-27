import { describe, expect, it } from 'vitest';
import { editarMoedaCampo, formatValorMoeda, formatValorMoedaCampo } from './moneyBr.js';

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

describe('editarMoedaCampo', () => {
  it('formata número «fechado» ao digitar (1700 → 1.700,00)', () => {
    expect(editarMoedaCampo('1700')).toBe('1.700,00');
  });

  it('mantém 1–2 dígitos enquanto digita', () => {
    expect(editarMoedaCampo('17')).toBe('17');
  });

  it('finaliza com centavos no blur', () => {
    expect(editarMoedaCampo('17', { finalizar: true })).toBe('17,00');
    expect(editarMoedaCampo('1700', { finalizar: true })).toBe('1.700,00');
  });
});
