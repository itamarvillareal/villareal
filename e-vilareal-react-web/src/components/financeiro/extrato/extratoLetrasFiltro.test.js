import { describe, expect, it } from 'vitest';
import {
  LETRAS_MODO_EXCLUIR,
  LETRAS_MODO_INCLUIR,
  letrasParaQueryApi,
  linhaBateFiltroLetras,
  normalizarLetrasFiltro,
  parseLetrasFiltroParam,
  rotuloLetrasFiltro,
} from './extratoLetrasFiltro.js';

describe('extratoLetrasFiltro', () => {
  it('normaliza e deduplica letras', () => {
    expect(normalizarLetrasFiltro(['e', 'A', 'a', 'F'])).toEqual(['A', 'E', 'F']);
  });

  it('lê letras e modo da URL', () => {
    const params = new URLSearchParams('letras=E,A&letrasModo=excluir');
    expect(parseLetrasFiltroParam(params)).toEqual({
      letras: ['A', 'E'],
      letrasModo: LETRAS_MODO_EXCLUIR,
    });
  });

  it('legado conta=A vira incluir A', () => {
    const params = new URLSearchParams('conta=A');
    expect(parseLetrasFiltroParam(params)).toEqual({
      letras: ['A'],
      letrasModo: LETRAS_MODO_INCLUIR,
    });
  });

  it('monta query da API', () => {
    expect(
      letrasParaQueryApi({ letras: ['A', 'F'], letrasModo: LETRAS_MODO_INCLUIR }),
    ).toEqual({ contaCodigos: 'A,F', contaCodigosExcluir: undefined });
    expect(
      letrasParaQueryApi({ letras: ['E'], letrasModo: LETRAS_MODO_EXCLUIR }),
    ).toEqual({ contaCodigos: 'E', contaCodigosExcluir: true });
  });

  it('rotulo descreve filtro ativo', () => {
    expect(rotuloLetrasFiltro({ letras: [], letrasModo: LETRAS_MODO_INCLUIR })).toBe('Letras');
    expect(rotuloLetrasFiltro({ letras: ['F'], letrasModo: LETRAS_MODO_INCLUIR })).toBe('Somente F');
    expect(rotuloLetrasFiltro({ letras: ['E'], letrasModo: LETRAS_MODO_EXCLUIR })).toBe('Exceto E');
  });

  it('linhaBateFiltroLetras inclui ou exclui por contaCodigo', () => {
    const rowE = { contaCodigo: 'E' };
    const rowA = { contaCodigo: 'A' };
    expect(linhaBateFiltroLetras(rowE, { letras: ['E'], letrasModo: LETRAS_MODO_INCLUIR })).toBe(true);
    expect(linhaBateFiltroLetras(rowA, { letras: ['E'], letrasModo: LETRAS_MODO_INCLUIR })).toBe(false);
    expect(linhaBateFiltroLetras(rowA, { letras: ['E'], letrasModo: LETRAS_MODO_EXCLUIR })).toBe(true);
    expect(linhaBateFiltroLetras(rowE, { letras: ['E'], letrasModo: LETRAS_MODO_EXCLUIR })).toBe(false);
  });
});
