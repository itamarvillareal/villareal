import { describe, expect, it } from 'vitest';
import {
  MTD_PRIORIDADE_IDOSO,
  MTD_RACA_COR,
  mtdDescricaoRacaCor,
  mtdNormalizarListaString,
} from './datajudMtd12.js';

describe('datajudMtd12 (MTD 1.2)', () => {
  it('mtdNormalizarListaString — array e string única', () => {
    expect(mtdNormalizarListaString(['a', ' b ', ''])).toEqual(['a', 'b']);
    expect(mtdNormalizarListaString('  x  ')).toEqual(['x']);
    expect(mtdNormalizarListaString('')).toBeNull();
    expect(mtdNormalizarListaString(null)).toBeNull();
  });

  it('MTD_RACA_COR contém códigos do XSD', () => {
    expect(Object.keys(MTD_RACA_COR).sort()).toEqual(['AM', 'BC', 'IN', 'ND', 'PD', 'PR', 'QL']);
  });

  it('MTD_PRIORIDADE_IDOSO = ID (idoso)', () => {
    expect(MTD_PRIORIDADE_IDOSO).toBe('ID');
  });

  it('mtdDescricaoRacaCor', () => {
    expect(mtdDescricaoRacaCor('PR')).toBe('Preto(a)');
    expect(mtdDescricaoRacaCor('pr')).toBe('Preto(a)');
    expect(mtdDescricaoRacaCor('XX')).toBe('XX');
  });
});
