import { describe, expect, it } from 'vitest';
import {
  montarPatchCabecalhoCampoRelatorio,
  parseStatusAtivoRelatorio,
  tipoPersistenciaCampoRelatorio,
} from './relatorioProcessoCampoPersistencia.js';

describe('relatorioProcessoCampoPersistencia', () => {
  it('identifica campos persistíveis no cabeçalho', () => {
    expect(tipoPersistenciaCampoRelatorio('unidade')).toBe('cabecalho');
    expect(tipoPersistenciaCampoRelatorio('statusAtivoTexto')).toBe('ativo');
    expect(tipoPersistenciaCampoRelatorio('ultimoAndamento')).toBeNull();
    expect(tipoPersistenciaCampoRelatorio('codCliente')).toBeNull();
  });

  it('monta patch de unidade e natureza', () => {
    expect(montarPatchCabecalhoCampoRelatorio('unidade', ' 1201 R ')).toEqual({ unidade: '1201 R' });
    expect(montarPatchCabecalhoCampoRelatorio('descricaoAcao', 'Execução')).toEqual({
      naturezaAcao: 'Execução',
      descricaoAcao: 'Execução',
    });
  });

  it('interpreta status ativo/inativo', () => {
    expect(parseStatusAtivoRelatorio('Ativo')).toBe(true);
    expect(parseStatusAtivoRelatorio('inativo')).toBe(false);
    expect(parseStatusAtivoRelatorio('xyz')).toBeNull();
  });
});
