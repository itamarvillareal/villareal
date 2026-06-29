import { describe, expect, it } from 'vitest';
import {
  MODOS_FILTRO_COLUNA,
  linhaPassaFiltroColunaRelatorio,
  valorCelulaRelatorioVazia,
} from './relatorioFiltroColuna.js';

describe('relatorioFiltroColuna', () => {
  it('valorCelulaRelatorioVazia reconhece vazio e placeholders', () => {
    expect(valorCelulaRelatorioVazia('')).toBe(true);
    expect(valorCelulaRelatorioVazia('   ')).toBe(true);
    expect(valorCelulaRelatorioVazia('—')).toBe(true);
    expect(valorCelulaRelatorioVazia('00012345')).toBe(false);
  });

  it('modo vazios só aceita células vazias', () => {
    expect(linhaPassaFiltroColunaRelatorio('', '', MODOS_FILTRO_COLUNA.vazios)).toBe(true);
    expect(linhaPassaFiltroColunaRelatorio('CNJ 123', '', MODOS_FILTRO_COLUNA.vazios)).toBe(false);
  });

  it('modo preenchidos rejeita vazios', () => {
    expect(linhaPassaFiltroColunaRelatorio('x', '', MODOS_FILTRO_COLUNA.preenchidos)).toBe(true);
    expect(linhaPassaFiltroColunaRelatorio('', '', MODOS_FILTRO_COLUNA.preenchidos)).toBe(false);
  });

  it('modo contem aceita atalho vazio no texto', () => {
    expect(linhaPassaFiltroColunaRelatorio('', 'vazio', MODOS_FILTRO_COLUNA.contem)).toBe(true);
    expect(linhaPassaFiltroColunaRelatorio('abc', 'vazio', MODOS_FILTRO_COLUNA.contem)).toBe(false);
  });
});
