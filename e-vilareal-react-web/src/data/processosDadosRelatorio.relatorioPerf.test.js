import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/featureFlags.js', () => ({
  featureFlags: { useApiProcessos: true, useApiClientes: true },
}));

const mockListarAndamentos = vi.fn();
const mockObterCampos = vi.fn();
const mockListarPartes = vi.fn();
const mockResolverId = vi.fn();

vi.mock('../repositories/processosRepository.js', async () => {
  const actual = await vi.importActual('../repositories/processosRepository.js');
  return {
    ...actual,
    listarAndamentosProcesso: (...args) => mockListarAndamentos(...args),
    obterCamposProcessoApiFirst: (...args) => mockObterCampos(...args),
    listarPartesProcesso: (...args) => mockListarPartes(...args),
    resolverProcessoId: (...args) => mockResolverId(...args),
  };
});

vi.mock('./processosHistoricoData.js', () => ({
  getRegistroProcesso: vi.fn(() => null),
  obterStatusAtivoUnificado: vi.fn((_c, _p, fb) => fb !== false),
}));

import {
  limparCacheCamposRelatorioApi,
  preaquecerCamposRelatorioApiFirst,
  seedCacheRelatorioFromProcessoListagem,
  temCacheCamposRelatorioApi,
} from './processosDadosRelatorio.js';

beforeEach(() => {
  vi.clearAllMocks();
  limparCacheCamposRelatorioApi();
});

describe('seedCacheRelatorioFromProcessoListagem', () => {
  it('preenche cache com cabeçalho da listagem sem GET detalhado', () => {
    seedCacheRelatorioFromProcessoListagem('00000299', 17, {
      id: 3280,
      codigoCliente: '00000299',
      numeroInterno: 17,
      numeroCnj: '1234567-89.2026.8.09.0001',
      unidade: 'Unidade 402 R',
      parteCliente: 'Condomínio X',
      parteOposta: 'Fulano',
      fase: 'Em Andamento',
      ativo: true,
    });
    expect(temCacheCamposRelatorioApi('00000299', 17)).toBe(true);
    expect(mockObterCampos).not.toHaveBeenCalled();
    expect(mockListarPartes).not.toHaveBeenCalled();
  });
});

describe('preaquecerCamposRelatorioApiFirst — após seed', () => {
  it('busca só andamentos (1 GET) em vez de processo+partes+andamentos', async () => {
    seedCacheRelatorioFromProcessoListagem('00000299', 17, {
      id: 3280,
      codigoCliente: '00000299',
      numeroInterno: 17,
      unidade: 'Unidade 402 R',
      ativo: true,
    });
    mockListarAndamentos.mockResolvedValue([
      { titulo: 'Movimento recente', movimentoEm: '2026-03-01T12:00:00' },
    ]);

    await preaquecerCamposRelatorioApiFirst([{ codCliente: '00000299', proc: '17', processoId: 3280 }]);

    expect(mockListarAndamentos).toHaveBeenCalledTimes(1);
    expect(mockListarAndamentos).toHaveBeenCalledWith(3280);
    expect(mockObterCampos).not.toHaveBeenCalled();
    expect(mockListarPartes).not.toHaveBeenCalled();
  });
});
