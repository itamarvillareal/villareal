import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as hist from './processosHistoricoData.js';
import {
  buscarHitIndiceCnjPorCnj,
  montarIndiceCnjClienteProcAsync,
  resolverSugestaoVinculoLinha,
  vincularPublicacaoAoCadastro,
} from './publicacoesVinculoProcessos.js';
import {
  processarTextoPdfPublicacoes,
  deduplicarParseados,
  fundirParesComplementaresPublicacoes,
} from './publicacoesPdfParser.js';

const { listarClientesIndiceCadastro, listarProcessosResumoPorCodigoCliente } = vi.hoisted(() => ({
  listarClientesIndiceCadastro: vi.fn(),
  listarProcessosResumoPorCodigoCliente: vi.fn(),
}));

vi.mock('../config/featureFlags.js', () => ({
  featureFlags: { useApiProcessos: true, useApiClientes: true },
}));

vi.mock('../repositories/clientesRepository.js', () => ({
  listarClientesIndiceCadastro: (...args) => listarClientesIndiceCadastro(...args),
}));

vi.mock('../repositories/processosRepository.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    listarProcessosResumoPorCodigoCliente: (...args) => listarProcessosResumoPorCodigoCliente(...args),
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

  it('associa por tolerância de 1 dígito no 1.º segmento (busca parcial < 20 dígitos)', () => {
    const map = new Map();
    const cadastro = { codCliente: '00000766', proc: '3', cliente: 'X', reu: 'Y' };
    map.set('5402633-78.2017.8.09.0006', cadastro);
    const r = buscarHitIndiceCnjPorCnj(map, '5482633');
    expect(r?.hit).toEqual(cadastro);
    expect(r?.chaveUsada).toBe('5402633-78.2017.8.09.0006');
  });

  it('CNJ completo (20 dígitos): não usa fuzzy de 1 dígito no índice', () => {
    const map = new Map();
    const cadastro = { codCliente: '00000100', proc: '15', cliente: 'Cliente', reu: 'Réu' };
    map.set('54026337820178090006', cadastro);
    const r = buscarHitIndiceCnjPorCnj(map, '5482633-78.2017.8.09.0006');
    expect(r).toBeNull();
  });

  it('CNJ completo: igualdade exata no índice', () => {
    const map = new Map();
    const cadastro = { codCliente: '00000100', proc: '15', processoId: '99', cliente: 'Cliente', reu: 'Réu' };
    map.set('5402633-78.2017.8.09.0006', cadastro);
    const r = buscarHitIndiceCnjPorCnj(map, '5402633-78.2017.8.09.0006');
    expect(r?.hit).toEqual(cadastro);
  });

  it('pipeline Gmail/Jusbrasil: CNJ 548… no PDF vincula ao cadastro 540…', () => {
    const texto = `
Processo
5482633-78.2017.8.09.0006
Termos encontrados
ITAMAR ALEXANDRE FELIX VILLA REAL
Data de disponibilização
12/05/26
Data de publicação
13/05/26
Diário
TJGO · Tribunal de Justiça de Goiás

Publicação
Unidade Jurisdicional NÚMERO ÚNICO: 5482633-78.2017.8.09.0006 POLO ATIVO
ARQUIVOS DIGITAIS INDISPONÍVEIS (NÃO SÃO DO TIPO PÚBLICO)
`.trim();
    const { parseados } = processarTextoPdfPublicacoes(texto);
    const { itens: ded } = deduplicarParseados(parseados);
    const fund = fundirParesComplementaresPublicacoes(ded);
    const map = new Map();
    map.set('5482633-78.2017.8.09.0006', {
      codCliente: '00000100',
      proc: '15',
      cliente: 'Cliente Teste',
      reu: 'Parte ré',
    });
    const row = fund.find((r) => String(r.processoCnjNormalizado || '').includes('5482633'));
    expect(row).toBeTruthy();
    const v = vincularPublicacaoAoCadastro(row, map);
    expect(v.statusVinculo).toBe('vinculado');
    expect(v.codCliente).toBe('00000100');
    expect(v.procInterno).toBe('15');
    expect(v.reu).toBe('Parte ré');
  });
});

describe('montarIndiceCnjClienteProcAsync', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    listarClientesIndiceCadastro.mockReset();
    listarProcessosResumoPorCodigoCliente.mockReset();
  });

  beforeEach(() => {
    listarClientesIndiceCadastro.mockResolvedValue([{ codigo: '00000513', nomeRazao: 'Cliente X' }]);
    listarProcessosResumoPorCodigoCliente.mockResolvedValue([
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
    listarProcessosResumoPorCodigoCliente.mockResolvedValue([
      { id: 1, codigoCliente: '00000513', numeroInterno: 9, numeroCnj: null },
    ]);
    const spy = vi.spyOn(hist, 'obterNumeroProcessoNovoUnificado').mockReturnValue('5393953-78.2021.8.09.0006');
    const map = await montarIndiceCnjClienteProcAsync();
    expect(spy).toHaveBeenCalled();
    expect(buscarHitIndiceCnjPorCnj(map, '5393953-78.2021.8.09.0006')?.hit?.proc).toBe('9');
  });
});

describe('resolverSugestaoVinculoLinha', () => {
  it('resolve sugestão da API com número Projudi parcial', () => {
    const sugestoesApi = new Map([
      [
        '17513485',
        {
          codCliente: '00000473',
          procInterno: '36',
          cliente: 'ITAMAR',
          reu: 'RIDANI',
        },
      ],
    ]);
    const sug = resolverSugestaoVinculoLinha(
      {
        statusVinculo: 'nao_vinculado',
        processoCnjNormalizado: '175134.85',
      },
      new Map(),
      sugestoesApi
    );
    expect(sug?.codCliente).toBe('00000473');
    expect(sug?.procInterno).toBe('36');
    expect(sug?.fonte).toBe('api');
  });

  it('não vincula 5500622.97 (Asfarol) ao CNJ 5505622-97 (Vânia) — 1 dígito não é fuzzy', () => {
    const map = new Map();
    map.set('5505622-97.2025.8.09.0006', {
      codCliente: '00000993',
      proc: '3',
      cliente: 'VÂNIA CORREA HELOU',
      reu: 'BANCO SANTANDER',
    });
    map.set('5500622-97.2025.8.09.0006', {
      codCliente: '00000100',
      proc: '1',
      cliente: 'ASFAROL',
      reu: 'CARLOS BESSA',
    });
    expect(buscarHitIndiceCnjPorCnj(map, '5500622.97')?.hit?.codCliente).toBe('00000100');
    expect(buscarHitIndiceCnjPorCnj(map, '5500622.97')?.hit?.cliente).toBe('ASFAROL');
  });

  it('resolve sugestão pelo índice quando cadastro usa CNJ Projudi com ponto', () => {
    const map = new Map();
    map.set('5780425-64.2024.8.09.0007', {
      codCliente: '00000752',
      proc: '293',
      cliente: 'M&S ANÁPOLIS',
      reu: 'RÉU TESTE',
    });
    const sug = resolverSugestaoVinculoLinha(
      {
        statusVinculo: 'nao_vinculado',
        processoCnjNormalizado: '5780425.64',
      },
      map,
      new Map()
    );
    expect(sug?.codCliente).toBe('00000752');
    expect(sug?.procInterno).toBe('293');
    expect(sug?.fonte).toBe('cadastro');
  });
});

describe('montarIndiceCnjClienteProcAsync cnj projudi ponto', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    listarClientesIndiceCadastro.mockReset();
    listarProcessosResumoPorCodigoCliente.mockReset();
  });

  it('indexa CNJ gravado como 5780425.64.2024… (formato Projudi legado)', async () => {
    listarClientesIndiceCadastro.mockResolvedValue([{ codigo: '00000752', nomeRazao: 'Cliente 752' }]);
    listarProcessosResumoPorCodigoCliente.mockResolvedValue([
      {
        id: 12499,
        codigoCliente: '00000752',
        numeroInterno: 293,
        numeroCnj: '5780425.64.2024.8.09.0007',
      },
    ]);
    const map = await montarIndiceCnjClienteProcAsync();
    const r = buscarHitIndiceCnjPorCnj(map, '5780425.64');
    expect(r?.hit?.codCliente).toBe('00000752');
    expect(r?.hit?.proc).toBe('293');
  });
});
