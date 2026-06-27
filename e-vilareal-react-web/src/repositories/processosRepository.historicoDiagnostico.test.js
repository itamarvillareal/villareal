import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as historicoData from '../data/processosHistoricoData.js';
import { request } from '../api/httpClient.js';
import {
  erroEndpointHistoricoDataIndisponivel,
  listarHistoricoPorDataDiagnostico,
  listarProcessosFaseAguardandoProtocoloDiagnostico,
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

  it('agrupa vários andamentos do mesmo processo numa linha (legado VB)', async () => {
    vi.mocked(request).mockResolvedValue([
      {
        codigoCliente: '728',
        numeroInterno: 973,
        cliente: 'C',
        info: 'Nota antiga',
        data: '21/05/2026',
        andamentoId: 1,
      },
      {
        codigoCliente: '728',
        numeroInterno: 973,
        cliente: 'C',
        info: 'Nota recente',
        data: '21/05/2026',
        andamentoId: 99,
      },
    ]);

    const itens = await listarHistoricoPorDataDiagnostico('21/05/2026');
    expect(itens).toHaveLength(1);
    expect(itens[0].info).toBe('Nota recente');
    expect(itens[0].id).toBe(99);
  });

  it('umaLinhaPorProcesso=false mantém todas as linhas', async () => {
    vi.mocked(request).mockResolvedValue([
      { codigoCliente: '728', numeroInterno: 973, info: 'A', data: '21/05/2026', andamentoId: 1 },
      { codigoCliente: '728', numeroInterno: 973, info: 'B', data: '21/05/2026', andamentoId: 2 },
    ]);
    const itens = await listarHistoricoPorDataDiagnostico('21/05/2026', { umaLinhaPorProcesso: false });
    expect(itens).toHaveLength(2);
  });
});

describe('erroEndpointHistoricoDataIndisponivel', () => {
  it('detecta mensagem do backend desatualizado', () => {
    expect(
      erroEndpointHistoricoDataIndisponivel(new Error('No static resource api/processos/diagnostico/historico-data')),
    ).toBe(true);
  });
});

describe('listarProcessosFaseAguardandoProtocoloDiagnostico', () => {
  beforeEach(() => {
    vi.mocked(request).mockReset();
    vi.spyOn(historicoData, 'listarProcessosFaseAguardandoProtocolo').mockReturnValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('não reintroduz processo local quando a API já mudou a fase', async () => {
    vi.mocked(request).mockImplementation(async (path, opts) => {
      if (path === '/api/processos/diagnostico/aguardando-protocolo') return [];
      if (path === '/api/processos/diagnostico/aguardando-protocolo/cnjs-fila-projudi') return [];
      if (path === '/api/processos') {
        expect(opts?.query?.codigoCliente).toBe('00000578');
        expect(opts?.query?.numeroInterno).toBe('134');
        return { id: 1, numeroInterno: 134, fase: 'Em Andamento' };
      }
      throw new Error(`unexpected ${path}`);
    });
    historicoData.listarProcessosFaseAguardandoProtocolo.mockReturnValue([
      {
        codCliente: '00000578',
        proc: '134',
        cliente: 'Condomínio',
        faseSelecionada: 'Protocolo / Movimentação',
      },
    ]);

    const itens = await listarProcessosFaseAguardandoProtocoloDiagnostico();
    expect(itens).toHaveLength(0);
  });

  it('mantém processo só no histórico local quando não existe na API', async () => {
    vi.mocked(request).mockImplementation(async (path) => {
      if (path === '/api/processos/diagnostico/aguardando-protocolo') return [];
      if (path === '/api/processos/diagnostico/aguardando-protocolo/cnjs-fila-projudi') return [];
      if (path === '/api/processos') {
        const err = new Error('404 não encontrado');
        throw err;
      }
      throw new Error(`unexpected ${path}`);
    });
    historicoData.listarProcessosFaseAguardandoProtocolo.mockReturnValue([
      {
        codCliente: '00000999',
        proc: '1',
        cliente: 'Só local',
        faseSelecionada: 'Protocolo / Movimentação',
      },
    ]);

    const itens = await listarProcessosFaseAguardandoProtocoloDiagnostico();
    expect(itens).toHaveLength(1);
    expect(itens[0].proc).toBe('1');
  });

  it('prioriza linhas da API e deduplica com local', async () => {
    vi.mocked(request).mockImplementation(async (path) => {
      if (path === '/api/processos/diagnostico/aguardando-protocolo/cnjs-fila-projudi') return [];
      if (path === '/api/processos/diagnostico/aguardando-protocolo') {
        return [
          {
            codigoCliente: '578',
            numeroInterno: 134,
            cliente: 'API',
            parteOposta: 'Réu',
          },
        ];
      }
      throw new Error(`unexpected ${path}`);
    });
    historicoData.listarProcessosFaseAguardandoProtocolo.mockReturnValue([
      {
        codCliente: '00000578',
        proc: '134',
        cliente: 'Local',
        faseSelecionada: 'Protocolo / Movimentação',
      },
    ]);

    const itens = await listarProcessosFaseAguardandoProtocoloDiagnostico();
    expect(itens).toHaveLength(1);
    expect(itens[0].cliente).toBe('API');
  });

  it('omite processo com petição na fila PROJUDI (ex.: agendada)', async () => {
    vi.mocked(request).mockImplementation(async (path) => {
      if (path === '/api/processos/diagnostico/aguardando-protocolo/cnjs-fila-projudi') {
        return ['57861278820258090007'];
      }
      if (path === '/api/processos/diagnostico/aguardando-protocolo') {
        return [
          {
            codigoCliente: '703',
            numeroInterno: 2,
            cliente: 'Maria',
            numeroProcessoNovo: '5786127-88.2025.8.09.0007',
          },
        ];
      }
      throw new Error(`unexpected ${path}`);
    });

    const itens = await listarProcessosFaseAguardandoProtocoloDiagnostico();
    expect(itens).toHaveLength(0);
  });
});
