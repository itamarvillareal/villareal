import { describe, expect, it } from 'vitest';
import {
  normalizarBancosFiltro,
  parseBancosFiltroParam,
  rotuloBancosFiltro,
} from './inboxBancosFiltro.js';

describe('inboxBancosFiltro', () => {
  it('parseBancosFiltroParam aceita um ou vários bancos', () => {
    expect(parseBancosFiltroParam(new URLSearchParams('banco=1'))).toEqual([1]);
    expect(parseBancosFiltroParam(new URLSearchParams('banco=1,12'))).toEqual([1, 12]);
  });

  it('normalizarBancosFiltro deduplica e ordena', () => {
    expect(normalizarBancosFiltro([12, 1, 12])).toEqual([1, 12]);
  });

  it('rotuloBancosFiltro exibe nomes ou contagem', () => {
    const catalogo = [
      { numero: 1, nome: 'Itaú' },
      { numero: 12, nome: 'CORA' },
    ];
    expect(rotuloBancosFiltro([], catalogo)).toBe('Todos os bancos');
    expect(rotuloBancosFiltro([1, 12], catalogo)).toBe('Itaú, CORA');
  });
});
