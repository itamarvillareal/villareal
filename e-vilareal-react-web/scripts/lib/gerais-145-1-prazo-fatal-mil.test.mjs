import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  caminhoArquivoPrazoFatalGerais,
  caminhoClienteAlinhaSubpastaVb,
  resolverBaseGeraisPrazoFatal,
} from './gerais-145-1-prazo-fatal-mil.mjs';

describe('caminhoClienteAlinhaSubpastaVb', () => {
  it('cliente 149 → 1000/100/149', () => {
    assert.equal(caminhoClienteAlinhaSubpastaVb(149, '1000', '100', '149'), true);
    assert.equal(caminhoClienteAlinhaSubpastaVb(149, '1000', '200', '149'), false);
  });

  it('cliente 491 → 1000/400/491 (VB subpasta)', () => {
    assert.equal(caminhoClienteAlinhaSubpastaVb(491, '1000', '400', '491'), true);
    assert.equal(caminhoClienteAlinhaSubpastaVb(491, '1000', '500', '491'), false);
  });

  it('cliente 728 → 1000/700/728', () => {
    assert.equal(caminhoClienteAlinhaSubpastaVb(728, '1000', '700', '728'), true);
  });
});

describe('caminhoArquivoPrazoFatalGerais', () => {
  it('cliente 491 proc 208 → Gerais/1000/400/491/00000491.145.1.208.txt', () => {
    const base = '/tmp/Banco de Dados/Gerais';
    const abs = caminhoArquivoPrazoFatalGerais(base, 491, 208);
    assert.equal(
      abs,
      path.join(base, '1000', '400', '491', '00000491.145.1.208.txt')
    );
  });
});

describe('resolverBaseGeraisPrazoFatal', () => {
  it('sobe de 145.1 para Gerais', () => {
    const g = resolverBaseGeraisPrazoFatal('/tmp/Banco de Dados/Gerais/145.1');
    assert.equal(path.basename(g), 'Gerais');
  });
});
