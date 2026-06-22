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

import { buscarProcessoPorChaveNatural, buscarProcessoPorId } from './processosRepository.js';
import {
  derivarCodProcUiImovel,
  resolverVinculoProcessoParaSaveImovel,
} from './imoveisRepository.js';

describe('derivarCodProcUiImovel', () => {
  it('prioriza N:N da API sobre extras divergentes', () => {
    const r = derivarCodProcUiImovel(
      {
        processoId: 13058,
        codigoCliente: '00000793',
        numeroInternoProcesso: 17,
      },
      { codigo: '00000793', proc: '20' },
    );
    expect(r).toEqual({ codigo: '00000793', proc: '17', fonte: 'nn' });
  });

  it('usa extras quando não há processoId na API', () => {
    const r = derivarCodProcUiImovel(
      { processoId: null, codigoCliente: '00000938' },
      { codigo: '00000938', proc: '34' },
    );
    expect(r).toEqual({ codigo: '00000938', proc: '34', fonte: 'extras' });
  });
});

describe('resolverVinculoProcessoParaSaveImovel', () => {
  beforeEach(() => {
    vi.mocked(buscarProcessoPorId).mockReset();
    vi.mocked(buscarProcessoPorChaveNatural).mockReset();
  });

  it('save sem alteração: espelha N:N e mantém processoId (auto-cura extras)', async () => {
    vi.mocked(buscarProcessoPorId).mockResolvedValueOnce({
      id: 13058,
      codigoCliente: '00000793',
      numeroInterno: 17,
    });

    const r = await resolverVinculoProcessoParaSaveImovel({
      codigo: '00000793',
      proc: '17',
      _vinculoCodigoOriginal: '00000793',
      _vinculoProcOriginal: '17',
      _apiProcessoId: 13058,
    });

    expect(r).toEqual({
      alterouVinculo: false,
      processoIdPayload: 13058,
      espelhoCodigo: '00000793',
      espelhoProc: '17',
    });
    expect(buscarProcessoPorChaveNatural).not.toHaveBeenCalled();
  });

  it('save sem alteração com extras divergentes no payload: corrige espelho pela N:N', async () => {
    vi.mocked(buscarProcessoPorId).mockResolvedValueOnce({
      id: 13058,
      codigoCliente: '00000793',
      numeroInterno: 17,
    });

    const r = await resolverVinculoProcessoParaSaveImovel({
      codigo: '00000793',
      proc: '17',
      _vinculoCodigoOriginal: '00000793',
      _vinculoProcOriginal: '17',
      _apiProcessoId: 13058,
    });

    expect(r.espelhoProc).toBe('17');
    expect(r.processoIdPayload).toBe(13058);
    expect(r.alterouVinculo).toBe(false);
  });

  it('edição deliberada de cod+proc: re-vincula pelo novo par', async () => {
    vi.mocked(buscarProcessoPorChaveNatural).mockResolvedValueOnce({ id: 13061 });

    const r = await resolverVinculoProcessoParaSaveImovel({
      codigo: '00000793',
      proc: '20',
      _vinculoCodigoOriginal: '00000793',
      _vinculoProcOriginal: '17',
      _apiProcessoId: 13058,
    });

    expect(r).toEqual({
      alterouVinculo: true,
      processoIdPayload: 13061,
      espelhoCodigo: '00000793',
      espelhoProc: '20',
    });
    expect(buscarProcessoPorId).not.toHaveBeenCalled();
  });

  it('edição idempotente para o mesmo processo já vinculado', async () => {
    vi.mocked(buscarProcessoPorChaveNatural).mockResolvedValueOnce({ id: 13058 });

    const r = await resolverVinculoProcessoParaSaveImovel({
      codigo: '00000793',
      proc: '17',
      _vinculoCodigoOriginal: '00000793',
      _vinculoProcOriginal: '20',
      _apiProcessoId: 13058,
    });

    expect(r.alterouVinculo).toBe(true);
    expect(r.processoIdPayload).toBe(13058);
  });

  it('sem baseline no payload: detecta proc. divergente da N:N e re-vincula', async () => {
    vi.mocked(buscarProcessoPorId).mockResolvedValueOnce({
      id: 13058,
      codigoCliente: '00000793',
      numeroInterno: 17,
    });
    vi.mocked(buscarProcessoPorChaveNatural).mockResolvedValueOnce({ id: 13061 });

    const r = await resolverVinculoProcessoParaSaveImovel({
      codigo: '00000793',
      proc: '20',
      _apiProcessoId: 13058,
    });

    expect(r).toEqual({
      alterouVinculo: true,
      processoIdPayload: 13061,
      espelhoCodigo: '00000793',
      espelhoProc: '20',
    });
  });
});
