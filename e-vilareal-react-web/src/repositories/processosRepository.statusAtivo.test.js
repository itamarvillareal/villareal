import { describe, expect, it } from 'vitest';
import { mapApiProcessoToUiShape } from './processosRepository.js';

describe('mapApiProcessoToUiShape - statusAtivo', () => {
  it('trata campo ativo booleano e textual legado', () => {
    expect(mapApiProcessoToUiShape({ ativo: false }).statusAtivo).toBe(false);
    expect(mapApiProcessoToUiShape({ ativo: true }).statusAtivo).toBe(true);
    expect(mapApiProcessoToUiShape({ ativo: 'false' }).statusAtivo).toBe(false);
    expect(mapApiProcessoToUiShape({ ativo: '0' }).statusAtivo).toBe(false);
    expect(mapApiProcessoToUiShape({ ativo: 0 }).statusAtivo).toBe(false);
  });

  it('usa inativo legado quando ativo nao vier', () => {
    expect(mapApiProcessoToUiShape({ inativo: true }).statusAtivo).toBe(false);
    expect(mapApiProcessoToUiShape({ inativo: false }).statusAtivo).toBe(true);
    expect(mapApiProcessoToUiShape({ inativo: '1' }).statusAtivo).toBe(false);
    expect(mapApiProcessoToUiShape({ inativo: 'false' }).statusAtivo).toBe(true);
  });

  it('mantem padrao ativo quando status nao informado', () => {
    expect(mapApiProcessoToUiShape({}).statusAtivo).toBe(true);
  });
});
