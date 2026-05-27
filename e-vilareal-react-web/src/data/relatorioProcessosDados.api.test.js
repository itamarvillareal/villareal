import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/featureFlags.js', () => ({
  featureFlags: { useApiProcessos: true, useApiClientes: true },
}));

const mockListarClientes = vi.fn();
const mockListarProcessos = vi.fn();

vi.mock('../repositories/clientesRepository.js', () => ({
  listarClientesCadastro: () => mockListarClientes(),
}));

vi.mock('../repositories/processosRepository.js', async () => {
  const actual = await vi.importActual('../repositories/processosRepository.js');
  return {
    ...actual,
    listarProcessosPorCodigoCliente: (cod) => mockListarProcessos(cod),
  };
});

import { obterLinhasBaseRelatorioProcessos } from './relatorioProcessosDados.js';
import * as dadosRelatorio from './processosDadosRelatorio.js';

beforeEach(() => {
  mockListarClientes.mockReset();
  mockListarProcessos.mockReset();
  vi.restoreAllMocks();
});

describe('obterLinhasBaseRelatorioProcessos', () => {
  it('com API: monta linhas a partir de clientes e processos', async () => {
    mockListarClientes.mockResolvedValue([
      { codigo: '00000007', nomeRazao: 'Cliente Teste', clienteInativo: false },
    ]);
    mockListarProcessos.mockResolvedValue([
      {
        id: 101,
        codigoCliente: '00000007',
        numeroInterno: 3,
        numeroCnj: '5004132-55.2025.8.09.0001',
        naturezaAcao: 'Cobrança',
        competencia: '1º JEC',
        fase: 'Em Andamento',
        ativo: true,
      },
    ]);

    const rows = await obterLinhasBaseRelatorioProcessos();
    expect(rows).toHaveLength(1);
    expect(rows[0].codCliente).toBe('00000007');
    expect(rows[0].proc).toBe('3');
    expect(rows[0].cliente).toBe('Cliente Teste');
    expect(rows[0].numeroProcesso).toContain('5004132');
    expect(rows[0].descricaoAcao).toBe('Cobrança');
    expect(rows[0].processoCadastroAtivo).toBe(true);
    expect(rows[0].statusAtivoTexto).toBe('Ativo');
  });

  it('com API: histórico local inativo prevalece sobre listagem ativa', async () => {
    mockListarClientes.mockResolvedValue([{ codigo: '00000001', nomeRazao: 'Alexandra', clienteInativo: false }]);
    mockListarProcessos.mockResolvedValue([
      {
        id: 2,
        codigoCliente: '00000001',
        numeroInterno: 4,
        numeroCnj: '0000000-00.0000.0.00.0000',
        ativo: true,
      },
    ]);
    vi.spyOn(dadosRelatorio, 'resolverStatusAtivoRelatorioProcesso').mockReturnValue(false);
    const rows = await obterLinhasBaseRelatorioProcessos();
    expect(rows[0].processoCadastroAtivo).toBe(false);
    expect(rows[0].statusAtivoTexto).toBe('Inativo');
  });

  it('com API: marca processo inativo na linha base', async () => {
    mockListarClientes.mockResolvedValue([{ codigo: '00000001', nomeRazao: 'A', clienteInativo: false }]);
    mockListarProcessos.mockResolvedValue([
      {
        id: 2,
        codigoCliente: '00000001',
        numeroInterno: 1,
        numeroCnj: '0000000-00.0000.0.00.0000',
        ativo: false,
      },
    ]);
    const rows = await obterLinhasBaseRelatorioProcessos();
    expect(rows[0].processoCadastroAtivo).toBe(false);
    expect(rows[0].statusAtivoTexto).toBe('Inativo');
  });

  it('com API: retorna vazio quando não há clientes', async () => {
    mockListarClientes.mockResolvedValue([]);
    const rows = await obterLinhasBaseRelatorioProcessos();
    expect(rows).toEqual([]);
  });

  it('com API: ignora processo sem número interno válido', async () => {
    mockListarClientes.mockResolvedValue([{ codigo: '00000001', nomeRazao: 'A', clienteInativo: false }]);
    mockListarProcessos.mockResolvedValue([{ id: 1, codigoCliente: '00000001', numeroInterno: null }]);
    const rows = await obterLinhasBaseRelatorioProcessos();
    expect(rows).toHaveLength(0);
  });
});
