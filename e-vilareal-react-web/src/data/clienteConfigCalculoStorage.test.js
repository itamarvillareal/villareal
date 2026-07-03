import { describe, expect, it } from 'vitest';
import {
  normalizarHonorariosValorFixo,
  editarPercentualFixoCampo,
  percentualFixoParaCampo,
} from './clienteConfigCalculoStorage.js';

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

describe('percentualFixoParaCampo / editarPercentualFixoCampo', () => {
  it('exibe percentual sem símbolo %', () => {
    expect(percentualFixoParaCampo('20 %')).toBe('20');
    expect(percentualFixoParaCampo('10,5 %')).toBe('10,5');
  });

  it('permite digitar 20 sem inserir % no meio do texto', () => {
    expect(editarPercentualFixoCampo('2')).toBe('2');
    expect(editarPercentualFixoCampo('20')).toBe('20');
    expect(editarPercentualFixoCampo('20 %')).toBe('20');
  });

  it('aceita decimal com vírgula', () => {
    expect(editarPercentualFixoCampo('10,5')).toBe('10,5');
    expect(editarPercentualFixoCampo('10,')).toBe('10,');
  });
});
