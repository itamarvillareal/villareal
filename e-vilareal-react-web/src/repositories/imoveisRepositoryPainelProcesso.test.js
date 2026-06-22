import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/featureFlags.js', () => ({
  featureFlags: { useApiProcessos: true, useApiImoveis: true, useApiFinanceiro: true },
  FEATURE_IPTU_NOVO: true,
}));

vi.mock('./processosRepository.js', () => ({
  buscarProcessoPorId: vi.fn(),
  buscarProcessoPorChaveNatural: vi.fn(),
  buscarClientePorCodigo: vi.fn(),
  resolverProcessoId: vi.fn(),
}));

import { buscarProcessoPorId } from './processosRepository.js';
import { resolverChaveProcessoContaCorrentePainel } from './imoveisRepository.js';

describe('resolverChaveProcessoContaCorrentePainel', () => {
  beforeEach(() => {
    vi.mocked(buscarProcessoPorId).mockReset();
  });

  it('deriva cod+proc da N:N quando _apiProcessoId existe (extras divergente)', async () => {
    vi.mocked(buscarProcessoPorId).mockResolvedValueOnce({
      id: 13058,
      codigoCliente: '00000793',
      numeroInterno: 17,
    });

    const chave = await resolverChaveProcessoContaCorrentePainel({
      codigo: '00000793',
      proc: '20',
      _apiProcessoId: 13058,
    });

    expect(chave).toEqual({
      codigo: '00000793',
      proc: '17',
      processoId: 13058,
      fonteChave: 'nn',
    });
    expect(buscarProcessoPorId).toHaveBeenCalledWith(13058);
  });

  it('mantém extras quando não há _apiProcessoId', async () => {
    const chave = await resolverChaveProcessoContaCorrentePainel({
      codigo: '00000938',
      proc: '34',
      _apiProcessoId: null,
    });

    expect(chave).toEqual({
      codigo: '00000938',
      proc: '34',
      processoId: null,
      fonteChave: 'extras',
    });
    expect(buscarProcessoPorId).not.toHaveBeenCalled();
  });

  it('cai nos extras se a API do processo falhar', async () => {
    vi.mocked(buscarProcessoPorId).mockRejectedValueOnce(new Error('offline'));

    const chave = await resolverChaveProcessoContaCorrentePainel({
      codigo: '00000938',
      proc: '34',
      _apiProcessoId: 16043,
    });

    expect(chave.fonteChave).toBe('extras');
    expect(chave.proc).toBe('34');
    expect(chave.processoId).toBe(16043);
  });
});
