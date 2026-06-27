import { describe, expect, it } from 'vitest';
import { calcularPosicaoCursorMoedaBr, editarMoedaCampo, formatValorMoeda, formatValorMoedaCampo } from './moneyBr.js';

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
  it('formata milhar ao digitar sem forçar centavos (1700 → 1.700)', () => {
    expect(editarMoedaCampo('170')).toBe('170');
    expect(editarMoedaCampo('1700')).toBe('1.700');
  });

  it('mantém centavos parciais com vírgula', () => {
    expect(editarMoedaCampo('17,')).toBe('17,');
    expect(editarMoedaCampo('17,5')).toBe('17,5');
  });

  it('finaliza com centavos no blur', () => {
    expect(editarMoedaCampo('17', { finalizar: true })).toBe('17,00');
    expect(editarMoedaCampo('170', { finalizar: true })).toBe('170,00');
    expect(editarMoedaCampo('1700', { finalizar: true })).toBe('1.700,00');
    expect(editarMoedaCampo('1.700', { finalizar: true })).toBe('1.700,00');
  });
});

describe('calcularPosicaoCursorMoedaBr', () => {
  it('mantém posição lógica após inserir ponto de milhar', () => {
    expect(calcularPosicaoCursorMoedaBr('170', 3, '170')).toBe(3);
    expect(calcularPosicaoCursorMoedaBr('1700', 4, '1.700')).toBe(5);
  });
});
