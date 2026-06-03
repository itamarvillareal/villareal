import { describe, it, expect } from 'vitest';
import {
  formatarChaveProcessoVinculo,
  formatarRotuloVinculoPartes,
  obterParteClienteNomeLinha,
  obterTitularNomeLinha,
} from './publicacoesDisplayHelpers.js';

describe('publicacoesDisplayHelpers', () => {
  it('formatarChaveProcessoVinculo usa id do processo e nº interno', () => {
    expect(
      formatarChaveProcessoVinculo({
        codCliente: '00000600',
        _processoId: 8536,
        procInterno: '192',
      })
    ).toBe('00000600 / id 8536 (nº 192)');
  });

  it('obterParteClienteNomeLinha não usa titular quando parteCliente vazia', () => {
    expect(
      obterParteClienteNomeLinha({
        titularNome: 'CONDOMINIO RESIDENCIAL TORRES DO MIRANTE',
        parteCliente: '',
      })
    ).toBe('');
  });

  it('formatarRotuloVinculoPartes usa parteCliente, não nome do cliente contratante', () => {
    const row = {
      codCliente: '00000600',
      _processoId: 8536,
      procInterno: '192',
      titularNome: 'MEGA ELITE VIGILÂNCIA',
      parteCliente: 'MARÍLIA GABRIELA',
      cliente: 'M&S ANÁPOLIS',
      reu: 'GLEISMAR XAVIER DUTRA COSTA',
      statusVinculo: 'vinculado',
    };
    expect(obterTitularNomeLinha(row)).toBe('MEGA ELITE VIGILÂNCIA');
    expect(obterParteClienteNomeLinha(row)).toBe('MARÍLIA GABRIELA');
    expect(formatarRotuloVinculoPartes(row)).toContain('MARÍLIA GABRIELA');
    expect(formatarRotuloVinculoPartes(row)).not.toContain('M&S');
  });
});
