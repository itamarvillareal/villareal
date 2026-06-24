import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '../api/httpClient.js';
import {
  carregarImovelCadastroParaPainel,
  carregarImovelCadastroPorNumeroPlanilha,
} from './imoveisRepository.js';

vi.mock('../api/httpClient.js', () => ({
  request: vi.fn(),
}));

vi.mock('../config/featureFlags.js', () => ({
  featureFlags: { useApiImoveis: true, useApiProcessos: true },
  FEATURE_IPTU_NOVO: true,
}));

describe('carregarImovelCadastroPorNumeroPlanilha', () => {
  beforeEach(() => {
    vi.mocked(request).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('usa fallback da listagem quando montagem completa falha', async () => {
    vi.mocked(request).mockImplementation(async (path, opts) => {
      if (path === '/api/imoveis/por-numero-planilha/6') {
        return {
          id: 21,
          numeroPlanilha: 6,
          situacao: 'OCUPADO',
          unidade: 'Unidade 1803 A',
          camposExtrasJson: JSON.stringify({ codigo: '00000793', proc: '10' }),
        };
      }
      if (path === '/api/locacoes/contratos') {
        throw new Error('contratos indisponível');
      }
      if (path === '/api/imoveis/por-numero-planilha/6/vinculos-processo') {
        return { numeroPlanilha: 6, vinculos: [] };
      }
      throw new Error(`unexpected ${path}`);
    });

    const r = await carregarImovelCadastroPorNumeroPlanilha(6);
    expect(r.item).toBeTruthy();
    expect(r.item.imovelId).toBe(6);
    expect(r.item.imovelOcupado).toBe(true);
    expect(r.item.unidade).toBe('Unidade 1803 A');
  });

  it('não confunde nº da planilha 6 com id interno 6', async () => {
    vi.mocked(request).mockImplementation(async (path) => {
      if (path === '/api/imoveis/por-numero-planilha/6') {
        throw new Error('404 planilha');
      }
      if (path === '/api/imoveis') {
        return [
          { id: 6, numeroPlanilha: 31, situacao: 'DESOCUPADO', unidade: 'Unidade 1504 B' },
          {
            id: 21,
            numeroPlanilha: 6,
            situacao: 'OCUPADO',
            unidade: 'Unidade 1803 A',
            camposExtrasJson: JSON.stringify({ codigo: '00000793', proc: '10' }),
          },
        ];
      }
      if (path === '/api/imoveis/21') {
        throw new Error('detalhe indisponível');
      }
      if (path === '/api/imoveis/por-numero-planilha/6/vinculos-processo') {
        return { numeroPlanilha: 6, vinculos: [] };
      }
      if (path === '/api/imoveis/6') {
        throw new Error('não deve buscar id interno 6');
      }
      throw new Error(`unexpected ${path}`);
    });

    const r = await carregarImovelCadastroParaPainel({ imovelId: 6 });
    expect(r.item).toBeTruthy();
    expect(r.item.imovelId).toBe(6);
    expect(r.item.unidade).toBe('Unidade 1803 A');
    expect(r.item.imovelOcupado).toBe(true);
    expect(request).not.toHaveBeenCalledWith('/api/imoveis/6', expect.anything());
  });
});
