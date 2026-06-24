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

vi.mock('../api/httpClient.js', () => ({
  request: vi.fn(),
}));

import { request } from '../api/httpClient.js';
import { buscarProcessoPorId } from './processosRepository.js';
import {
  escolherVinculoPrincipalProcessoLista,
  resolverChaveProcessoContaCorrentePainel,
} from './imoveisRepository.js';

describe('escolherVinculoPrincipalProcessoLista', () => {
  it('prioriza principal sobre cadastroAtual e ordem da lista', () => {
    const vinculos = [
      { codigoCliente: '00000149', numeroInterno: 193, cadastroAtual: true, principal: false },
      { codigoCliente: '00000938', numeroInterno: 41, cadastroAtual: false, principal: true },
    ];
    expect(escolherVinculoPrincipalProcessoLista(vinculos).numeroInterno).toBe(41);
  });
});

describe('resolverChaveProcessoContaCorrentePainel', () => {
  beforeEach(() => {
    vi.mocked(buscarProcessoPorId).mockReset();
    vi.mocked(request).mockReset();
    vi.mocked(request).mockRejectedValue(new Error('sem vinculos'));
  });

  it('usa vínculo principal (938/41) mesmo com processoId antigo no cadastro (149/193)', async () => {
    vi.mocked(request).mockResolvedValueOnce({
      numeroPlanilha: 14,
      vinculos: [
        {
          codigoCliente: '00000149',
          numeroInterno: 193,
          processoId: 1001,
          cadastroAtual: true,
          principal: false,
        },
        {
          codigoCliente: '00000938',
          numeroInterno: 41,
          processoId: 2002,
          cadastroAtual: false,
          principal: true,
        },
      ],
    });

    const chave = await resolverChaveProcessoContaCorrentePainel({
      imovelId: 14,
      codigo: '00000149',
      proc: '193',
      _apiProcessoId: 1001,
    });

    expect(chave).toEqual({
      codigo: '00000938',
      proc: '41',
      processoId: 2002,
      fonteChave: 'principal',
    });
    expect(buscarProcessoPorId).not.toHaveBeenCalled();
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
