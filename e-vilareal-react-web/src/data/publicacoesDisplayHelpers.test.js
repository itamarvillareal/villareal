import { describe, it, expect } from 'vitest';
import {
  formatarChaveProcessoVinculo,
  formatarRotuloVinculoPartes,
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

  it('formatarRotuloVinculoPartes prioriza titularNome', () => {
    const row = {
      codCliente: '00000600',
      _processoId: 8536,
      procInterno: '192',
      titularNome: 'MEGA ELITE VIGILÂNCIA',
      cliente: 'M&S ANÁPOLIS',
      reu: 'GLEISMAR XAVIER DUTRA COSTA',
      statusVinculo: 'vinculado',
    };
    expect(obterTitularNomeLinha(row)).toBe('MEGA ELITE VIGILÂNCIA');
    expect(formatarRotuloVinculoPartes(row)).toContain('MEGA ELITE');
    expect(formatarRotuloVinculoPartes(row)).not.toContain('M&S');
  });
});
