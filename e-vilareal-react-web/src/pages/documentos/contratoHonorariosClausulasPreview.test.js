import { describe, expect, it } from 'vitest';
import {
  corpoClausula,
  excluirClausula,
  formatarClausula,
  incluirClausula,
  moverClausula,
  renumerarClausulas,
} from './contratoHonorariosClausulasPreview.js';

describe('contratoHonorariosClausulasPreview', () => {
  const amostra = [
    'Cláusula 1ª. Primeira.',
    'Cláusula 2ª. Segunda.',
    'Cláusula 3ª. Terceira.',
  ];

  it('renumerarClausulas atualiza prefixos', () => {
    const out = renumerarClausulas(['Cláusula 5ª. Foo', 'Cláusula 9ª. Bar']);
    expect(out[0]).toBe('Cláusula 1ª. Foo');
    expect(out[1]).toBe('Cláusula 2ª. Bar');
  });

  it('moverClausula reordena e renumera', () => {
    const out = moverClausula(amostra, 0, 1);
    expect(corpoClausula(out[0])).toBe('Segunda.');
    expect(corpoClausula(out[1])).toBe('Primeira.');
    expect(out[0]).toMatch(/^Cláusula 1ª\./);
    expect(out[1]).toMatch(/^Cláusula 2ª\./);
  });

  it('incluirClausula insere e renumera', () => {
    const out = incluirClausula(amostra, 1);
    expect(out).toHaveLength(4);
    expect(corpoClausula(out[2])).toBe('Texto da cláusula.');
    expect(out[3]).toBe(formatarClausula(4, 'Terceira.'));
  });

  it('excluirClausula remove e renumera', () => {
    const out = excluirClausula(amostra, 1);
    expect(out).toHaveLength(2);
    expect(corpoClausula(out[1])).toBe('Terceira.');
    expect(out[1]).toBe('Cláusula 2ª. Terceira.');
  });

  it('excluirClausula mantém ao menos uma', () => {
    expect(excluirClausula(['Cláusula 1ª. Única.'], 0)).toEqual(['Cláusula 1ª. Única.']);
  });
});
