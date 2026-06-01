import { describe, expect, it } from 'vitest';
import {
  caminhoClienteAlinhaSubpastaVb,
  resolverBaseGeraisPrazoFatal,
} from './gerais-145-1-prazo-fatal-mil.mjs';
import path from 'node:path';

describe('caminhoClienteAlinhaSubpastaVb', () => {
  it('cliente 149 → 1000/100/149', () => {
    expect(caminhoClienteAlinhaSubpastaVb(149, '1000', '100', '149')).toBe(true);
    expect(caminhoClienteAlinhaSubpastaVb(149, '1000', '200', '149')).toBe(false);
  });

  it('cliente 728 → 1000/700/728', () => {
    expect(caminhoClienteAlinhaSubpastaVb(728, '1000', '700', '728')).toBe(true);
  });
});

describe('resolverBaseGeraisPrazoFatal', () => {
  it('sobe de 145.1 para Gerais', () => {
    const g = resolverBaseGeraisPrazoFatal('/tmp/Banco de Dados/Gerais/145.1');
    expect(path.basename(g)).toBe('Gerais');
  });
});
