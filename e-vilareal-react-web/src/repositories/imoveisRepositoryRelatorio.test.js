import { beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '../api/httpClient.js';
import { carregarItensRelatorioImoveisApi } from './imoveisRepository.js';

vi.mock('../api/httpClient.js', () => ({
  request: vi.fn(),
}));

vi.mock('../config/featureFlags.js', () => ({
  featureFlags: { useApiImoveis: true, useApiProcessos: true },
  FEATURE_IPTU_NOVO: true,
}));

describe('carregarItensRelatorioImoveisApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('carrega cadastro uma vez por nº planilha, não por linha duplicada da listagem', async () => {
    const duplicados = Array.from({ length: 120 }, (_, i) => ({
      id: 1000 + i,
      numeroPlanilha: (i % 66) + 1,
      situacao: 'OCUPADO',
      unidade: `Unidade ${i}`,
    }));
    request.mockImplementation(async (path) => {
      if (path === '/api/imoveis') return duplicados;
      if (path.startsWith('/api/imoveis/por-numero-planilha/')) {
        const np = Number(path.split('/').pop());
        return {
          id: np + 100,
          numeroPlanilha: np,
          situacao: 'OCUPADO',
          unidade: `Planilha ${np}`,
          camposExtrasJson: '{}',
        };
      }
      if (path === '/api/locacoes/contratos') return [];
      if (path.includes('/processos')) return { vinculos: [] };
      return [];
    });

    const { ok, itens } = await carregarItensRelatorioImoveisApi();
    const getsPlanilha = request.mock.calls.filter(([path]) =>
      String(path).startsWith('/api/imoveis/por-numero-planilha/'),
    );

    expect(ok).toBe(true);
    expect(itens.length).toBe(66);
    expect(getsPlanilha.length).toBe(66);
  });
});
