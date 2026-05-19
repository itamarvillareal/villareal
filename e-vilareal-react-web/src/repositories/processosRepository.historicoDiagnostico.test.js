import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as historicoData from '../data/processosHistoricoData.js';
import { request } from '../api/httpClient.js';
import {
  erroEndpointHistoricoDataIndisponivel,
  listarHistoricoPorDataDiagnostico,
} from './processosRepository.js';

vi.mock('../api/httpClient.js', () => ({
  request: vi.fn(),
}));

vi.mock('../config/featureFlags.js', () => ({
  featureFlags: { useApiProcessos: true },
}));

describe('listarHistoricoPorDataDiagnostico', () => {
  beforeEach(() => {
    vi.mocked(request).mockReset();
    vi.spyOn(historicoData, 'listarHistoricoPorData').mockReturnValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mapeia linhas da API e ordena por andamentoId', async () => {
    vi.mocked(request).mockResolvedValue([
      {
        codigoCliente: '927',
        numeroInterno: 8,
        cliente: 'Cliente Teste',
        parteCliente: 'Cliente Teste',
        parteOposta: 'Réu',
        numeroProcessoNovo: '5338688-60.2023.8.09.0007',
        andamentoId: 42,
        info: 'Decisão publicada',
        data: '18/05/2026',
        usuario: 'ITAMAR',
      },
    ]);

    const itens = await listarHistoricoPorDataDiagnostico('18/05/2026');
    expect(request).toHaveBeenCalledWith('/api/processos/diagnostico/historico-data', {
      query: { data: '18/05/2026' },
    });
    expect(itens).toHaveLength(1);
    expect(itens[0].codCliente).toBe('00000927');
    expect(itens[0].proc).toBe('8');
    expect(itens[0].info).toBe('Decisão publicada');
    expect(itens[0].fromApi).toBe(true);
  });

  it('quando a API falha mas há histórico local, usa o local', async () => {
    vi.mocked(request).mockRejectedValue(new Error('No static resource api/processos/diagnostico/historico-data'));
    historicoData.listarHistoricoPorData.mockReturnValue([
      {
        codCliente: '00000927',
        proc: '8',
        cliente: 'Local',
        info: 'Linha local',
        data: '18/05/2026',
      },
    ]);

    const itens = await listarHistoricoPorDataDiagnostico('18/05/2026');
    expect(itens).toHaveLength(1);
    expect(itens[0].info).toBe('Linha local');
  });

  it('quando a API falha sem histórico local, propaga o erro', async () => {
    vi.mocked(request).mockRejectedValue(new Error('No static resource api/processos/diagnostico/historico-data'));

    await expect(listarHistoricoPorDataDiagnostico('18/05/2026')).rejects.toThrow(/historico-data/i);
  });

  it('quando a API retorna vazio, mantém fallback ao histórico local', async () => {
    vi.mocked(request).mockResolvedValue([]);
    historicoData.listarHistoricoPorData.mockReturnValue([
      {
        codCliente: '00000922',
        proc: '6',
        cliente: 'Local',
        info: 'Outra linha',
        data: '18/05/2026',
      },
    ]);

    const itens = await listarHistoricoPorDataDiagnostico('18/05/2026');
    expect(itens).toHaveLength(1);
    expect(itens[0].proc).toBe('6');
  });

  it('deduplica API e local pela mesma chave', async () => {
    vi.mocked(request).mockResolvedValue([
      {
        codigoCliente: '927',
        numeroInterno: 8,
        cliente: 'API',
        info: 'Mesma info',
        data: '18/05/2026',
        andamentoId: 1,
      },
    ]);
    historicoData.listarHistoricoPorData.mockReturnValue([
      {
        codCliente: '00000927',
        proc: '8',
        cliente: 'Local',
        info: 'Mesma info',
        data: '18/05/2026',
      },
    ]);

    const itens = await listarHistoricoPorDataDiagnostico('18/05/2026');
    expect(itens).toHaveLength(1);
    expect(itens[0].fromApi).toBe(true);
  });
});

describe('erroEndpointHistoricoDataIndisponivel', () => {
  it('detecta mensagem do backend desatualizado', () => {
    expect(
      erroEndpointHistoricoDataIndisponivel(new Error('No static resource api/processos/diagnostico/historico-data')),
    ).toBe(true);
  });
});
