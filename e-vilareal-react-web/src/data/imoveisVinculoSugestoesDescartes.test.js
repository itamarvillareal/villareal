import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map();

vi.stubGlobal('localStorage', {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
});

import {
  chaveDescarteVinculoImovel,
  descartarSugestaoVinculoImovel,
  filtrarSugestoesSemDescartadas,
  restaurarSugestaoVinculoImovel,
  sugestaoVinculoDescartadaParaPar,
} from './imoveisVinculoSugestoesDescartes.js';

describe('imoveisVinculoSugestoesDescartes', () => {
  beforeEach(() => {
    store.clear();
  });

  it('descarte só oculta o par Cod.+Proc. indicado', () => {
    descartarSugestaoVinculoImovel({ lancamentoId: 42, codigoCliente: '793', proc: '20' });
    expect(
      sugestaoVinculoDescartadaParaPar({ lancamentoId: 42, codigoCliente: '793', proc: '20' }),
    ).toBe(true);
    expect(
      sugestaoVinculoDescartadaParaPar({ lancamentoId: 42, codigoCliente: '999', proc: '5' }),
    ).toBe(false);

    const filtradas = filtrarSugestoesSemDescartadas([
      { lancamentoId: 42, codigoCliente: '793', proc: '20' },
      { lancamentoId: 42, codigoCliente: '999', proc: '5' },
    ]);
    expect(filtradas).toHaveLength(1);
    expect(filtradas[0].codigoCliente).toBe('999');
  });

  it('restaurar descarte libera só o par', () => {
    descartarSugestaoVinculoImovel({ lancamentoId: 7, codigoCliente: '793', proc: '20' });
    expect(restaurarSugestaoVinculoImovel(7, '793', '20')).toBe(true);
    expect(sugestaoVinculoDescartadaParaPar({ lancamentoId: 7, codigoCliente: '793', proc: '20' })).toBe(
      false,
    );
    expect(chaveDescarteVinculoImovel(7, '793', '20')).toBe('7|793|20');
  });
});
