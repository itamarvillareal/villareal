import { describe, expect, it } from 'vitest';
import {
  VALOR_FILTRO_EXATO,
  VALOR_FILTRO_GT0,
  VALOR_FILTRO_LT0,
  parseValorExtratoBr,
  parseValorFiltroParam,
  valorFiltroParaQueryApi,
} from './extratoValorFiltro.js';

describe('extratoValorFiltro', () => {
  it('parseValorExtratoBr entende formato BR e sinal', () => {
    expect(parseValorExtratoBr('1.500,00')).toBe(1500);
    expect(parseValorExtratoBr('-50,25')).toBe(-50.25);
    expect(parseValorExtratoBr('')).toBeNull();
  });

  it('mapeia lt0/gt0/exato para API', () => {
    expect(valorFiltroParaQueryApi({ valorFiltro: VALOR_FILTRO_LT0 })).toEqual({ natureza: 'DEBITO' });
    expect(valorFiltroParaQueryApi({ valorFiltro: VALOR_FILTRO_GT0 })).toEqual({ natureza: 'CREDITO' });
    expect(valorFiltroParaQueryApi({ valorFiltro: VALOR_FILTRO_EXATO, valorExato: -1738.8 })).toEqual({
      natureza: 'DEBITO',
      valorExato: 1738.8,
    });
    expect(valorFiltroParaQueryApi({ valorFiltro: VALOR_FILTRO_EXATO, valorExato: 100 })).toEqual({
      natureza: 'CREDITO',
      valorExato: 100,
    });
  });

  it('lê URL do filtro de valor', () => {
    const params = new URLSearchParams('valorFiltro=exato&valorExato=-50');
    expect(parseValorFiltroParam(params)).toEqual({
      valorFiltro: VALOR_FILTRO_EXATO,
      valorExato: -50,
    });
  });
});
