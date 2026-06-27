import { describe, expect, it } from 'vitest';
import { parseValorMonetarioBr } from './parseValorMonetarioBr.js';

describe('parseValorMonetarioBr', () => {
  it('interpreta milhar BR com vírgula decimal (sem confundir com decimal inglês)', () => {
    expect(parseValorMonetarioBr('R$1.200,45')).toBe(1200.45);
    expect(parseValorMonetarioBr('R$ 1.200,45')).toBe(1200.45);
    expect(parseValorMonetarioBr('1.200,45')).toBe(1200.45);
    expect(parseValorMonetarioBr('1.700')).toBe(1700);
    expect(parseValorMonetarioBr('12.345.678')).toBe(12345678);
  });

  it('aceita apenas vírgula decimal sem milhar', () => {
    expect(parseValorMonetarioBr('1234,56')).toBe(1234.56);
    expect(parseValorMonetarioBr('10,5')).toBe(10.5);
  });

  it('preserva número já numérico', () => {
    expect(parseValorMonetarioBr(1200.45)).toBe(1200.45);
    expect(parseValorMonetarioBr(0)).toBe(0);
  });

  it('formato com ponto decimal (EN) quando último separador é ponto', () => {
    expect(parseValorMonetarioBr('1200.45')).toBe(1200.45);
    expect(parseValorMonetarioBr('1,234.56')).toBe(1234.56);
    expect(parseValorMonetarioBr('1605.6')).toBe(1605.6);
    expect(parseValorMonetarioBr('1605,60')).toBe(1605.6);
  });

  it('retorna null para vazio ou inválido', () => {
    expect(parseValorMonetarioBr(null)).toBeNull();
    expect(parseValorMonetarioBr('')).toBeNull();
    expect(parseValorMonetarioBr('   ')).toBeNull();
    expect(parseValorMonetarioBr('R$')).toBeNull();
  });
});
