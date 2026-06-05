import { describe, expect, it } from 'vitest';
import { ENDERECAMENTOS } from '../pages/documentos/constants.js';
import { inferirEnderecamento, resolveSelectExato, resolveSelectInicial } from './documentoHelper.js';

describe('resolveSelectExato (endereçamento)', () => {
  const enderecoFamilia = inferirEnderecamento(
    '1ª VARA DE FAMÍLIA E SUCESSÕES',
    'Anápolis',
    'GO',
  );

  it('resolveSelectExato usa a competência do processo na lista', () => {
    const exato = resolveSelectExato(enderecoFamilia, ENDERECAMENTOS);
    expect(exato.select).toBe('MERITÍSSIMO JUÍZO DA 1ª VARA DE FAMÍLIA E SUCESSÕES DA COMARCA DE ANÁPOLIS - GO');
    expect(exato.outro).toBe('');
  });

  it('resolveSelectInicial pode confundir varas com prefixo parecido', () => {
    const opcoesSemFamiliaExata = ENDERECAMENTOS.filter(
      (o) => o !== 'MERITÍSSIMO JUÍZO DA 1ª VARA DE FAMÍLIA E SUCESSÕES DA COMARCA DE ANÁPOLIS - GO',
    );
    const parcial = resolveSelectInicial(enderecoFamilia, opcoesSemFamiliaExata);
    expect(parcial.select).toBe('MERITÍSSIMO JUÍZO DA 1ª VARA CÍVEL DA COMARCA DE ANÁPOLIS - GO');

    const exato = resolveSelectExato(enderecoFamilia, opcoesSemFamiliaExata);
    expect(exato.select).toBe('__outro__');
    expect(exato.outro).toBe(enderecoFamilia);
  });
});
