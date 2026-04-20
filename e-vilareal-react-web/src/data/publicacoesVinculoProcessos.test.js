import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as hist from './processosHistoricoData.js';
import { buscarHitIndiceCnjPorCnj, montarIndiceCnjClienteProcAsync } from './publicacoesVinculoProcessos.js';

const { listarClientesCadastro, listarProcessosPorCodigoCliente } = vi.hoisted(() => ({
  listarClientesCadastro: vi.fn(),
  listarProcessosPorCodigoCliente: vi.fn(),
}));

vi.mock('../config/featureFlags.js', () => ({
  featureFlags: { useApiProcessos: true, useApiClientes: true },
}));

vi.mock('../repositories/clientesRepository.js', () => ({
  listarClientesCadastro: (...args) => listarClientesCadastro(...args),
}));

vi.mock('../repositories/processosRepository.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    listarProcessosPorCodigoCliente: (...args) => listarProcessosPorCodigoCliente(...args),
  };
});

describe('buscarHitIndiceCnjPorCnj', () => {
  it('encontra no cadastro após remover zeros à esquerda do 1º segmento', () => {
    const map = new Map();
    const cadastro = { codCliente: '00000766', proc: '8', cliente: 'X', reu: 'Y' };
    map.set('356280-15.2016.8.09.0006'.toUpperCase(), cadastro);

    const r = buscarHitIndiceCnjPorCnj(map, '0356280-15.2016.8.09.0006');
    expect(r?.hit).toEqual(cadastro);
    expect(r?.chaveUsada).toBe('356280-15.2016.8.09.0006');
  });

  it('aceita chave canônica de 7 dígitos quando é a que está no mapa', () => {
    const map = new Map();
    const cadastro = { codCliente: '1', proc: '1', cliente: 'Z', reu: '' };
    map.set('0356280-15.2016.8.09.0006', cadastro);
    expect(buscarHitIndiceCnjPorCnj(map, '0356280-15.2016.8.09.0006')?.hit).toEqual(cadastro);
  });

  it('remove mais de um zero inicial se necessário', () => {
    const map = new Map();
    const cadastro = { codCliente: '1', proc: '2', cliente: 'A', reu: '' };
    map.set('56280-15.2016.8.09.0006'.toUpperCase(), cadastro);
    const r = buscarHitIndiceCnjPorCnj(map, '0056280-15.2016.8.09.0006');
    expect(r?.hit).toEqual(cadastro);
    expect(r?.chaveUsada).toBe('56280-15.2016.8.09.0006');
  });
});

describe('montarIndiceCnjClienteProcAsync', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    listarClientesCadastro.mockReset();
    listarProcessosPorCodigoCliente.mockReset();
  });

  beforeEach(() => {
    listarClientesCadastro.mockResolvedValue([{ codigo: '00000513', nomeRazao: 'Cliente X' }]);
    listarProcessosPorCodigoCliente.mockResolvedValue([
      { id: 1, codigoCliente: '00000513', numeroInterno: 9, numeroCnj: '5393953-78.2021.8.09.0006' },
    ]);
  });

  it('usa o CNJ da API para a chave do índice (não chama unificação com histórico local quando a API envia número)', async () => {
    const spy = vi.spyOn(hist, 'obterNumeroProcessoNovoUnificado').mockReturnValue('1111111-11.1111.8.09.1111');
    const map = await montarIndiceCnjClienteProcAsync();
    expect(spy).not.toHaveBeenCalled();
    const r = buscarHitIndiceCnjPorCnj(map, '5393953-78.2021.8.09.0006');
    expect(r?.hit?.proc).toBe('9');
    expect(r?.hit?.codCliente).toBe('00000513');
  });

  it('quando a API não envia CNJ, usa obterNumeroProcessoNovoUnificado', async () => {
    listarProcessosPorCodigoCliente.mockResolvedValue([
      { id: 1, codigoCliente: '00000513', numeroInterno: 9, numeroCnj: null },
    ]);
    const spy = vi.spyOn(hist, 'obterNumeroProcessoNovoUnificado').mockReturnValue('5393953-78.2021.8.09.0006');
    const map = await montarIndiceCnjClienteProcAsync();
    expect(spy).toHaveBeenCalled();
    expect(buscarHitIndiceCnjPorCnj(map, '5393953-78.2021.8.09.0006')?.hit?.proc).toBe('9');
  });
});
