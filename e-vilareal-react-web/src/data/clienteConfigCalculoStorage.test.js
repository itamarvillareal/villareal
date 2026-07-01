import { describe, expect, it } from 'vitest';
import { normalizarHonorariosValorFixo } from './clienteConfigCalculoStorage.js';

describe('normalizarHonorariosValorFixo', () => {
  it('mantém percentual já formatado', () => {
    expect(normalizarHonorariosValorFixo('20 %')).toBe('20 %');
    expect(normalizarHonorariosValorFixo('10,5 %')).toBe('10,5 %');
  });

  it('converte valor legado em R$ para percentual', () => {
    expect(normalizarHonorariosValorFixo('R$ 20')).toBe('20 %');
    expect(normalizarHonorariosValorFixo('20')).toBe('20 %');
  });

  it('retorna 0 % para vazio', () => {
    expect(normalizarHonorariosValorFixo('')).toBe('0 %');
    expect(normalizarHonorariosValorFixo(null)).toBe('0 %');
  });
});
