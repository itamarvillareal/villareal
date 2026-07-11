import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from '../api/httpClient.js';
import {
  carregarImovelCadastro,
  carregarImovelCadastroParaPainel,
  carregarImovelCadastroPorNumeroPlanilha,
  filtrarItensRelatorioPlanilhaAdmin,
} from './imoveisRepository.js';

vi.mock('../api/httpClient.js', () => ({
  request: vi.fn(),
}));

vi.mock('../config/featureFlags.js', () => ({
  featureFlags: { useApiImoveis: true, useApiProcessos: true },
  FEATURE_IPTU_NOVO: true,
}));

/** Snapshot VPS: id interno ≠ nº planilha na maioria dos registos (col. A). */
const CASOS_ARMADILHA = [
  { planilha: 1, idInternoErrado: 11, unidadeOk: 'Unidade 504 B', idErradoUnidade: 'Unidade 1504 B' },
  { planilha: 6, idInternoErrado: 6, unidadeOk: 'Unidade 1803 A', idErradoUnidade: 'Unidade 1504 B' },
  { planilha: 13, idInternoErrado: 13, unidadeOk: 'Unidade 403 A', idErradoUnidade: 'Unidade 1906 A' },
  { planilha: 21, idInternoErrado: 21, unidadeOk: 'Unidade 1803 A', idErradoUnidade: 'Casa F 18' },
  { planilha: 31, idInternoErrado: 6, unidadeOk: 'Unidade 1504 B', idErradoUnidade: 'Unidade 1803 A' },
];

const ID_INTERNO_POR_PLANILHA = { 1: 11, 6: 21, 13: 54, 21: 21, 31: 6 };

function mockImovelListagem({ id, numeroPlanilha, situacao, unidade, extras = {} }) {
  return {
    id,
    numeroPlanilha,
    situacao,
    unidade,
    camposExtrasJson: JSON.stringify(extras),
  };
}

function mockApiParaPlanilha(caso) {
  const idOk = ID_INTERNO_POR_PLANILHA[caso.planilha] ?? caso.planilha;
  const registroOk = mockImovelListagem({
    id: idOk,
    numeroPlanilha: caso.planilha,
    situacao: 'OCUPADO',
    unidade: caso.unidadeOk,
    extras: { codigo: '00000793', proc: '10' },
  });
  const registroIdErrado = mockImovelListagem({
    id: caso.idInternoErrado,
    numeroPlanilha: caso.planilha === 6 ? 31 : caso.planilha === 21 ? 21 : caso.planilha,
    situacao: 'DESOCUPADO',
    unidade: caso.idErradoUnidade,
  });

  vi.mocked(request).mockImplementation(async (path) => {
    if (path === `/api/imoveis/por-numero-planilha/${caso.planilha}`) {
      return { ...registroOk };
    }
    if (path === '/api/imoveis') return [registroIdErrado, registroOk];
    if (path === `/api/imoveis/${idOk}`) return registroOk;
    if (path === `/api/imoveis/${caso.idInternoErrado}`) return registroIdErrado;
    if (path === `/api/imoveis/por-numero-planilha/${caso.planilha}/vinculos-processo`) {
      return { numeroPlanilha: caso.planilha, vinculos: [] };
    }
    if (path === '/api/locacoes/contratos') throw new Error('contratos off');
    if (path === `/api/imoveis/${caso.idInternoErrado}` && caso.planilha !== 21) {
      throw new Error('não deve buscar id errado');
    }
    throw new Error(`unexpected ${path}`);
  });
}

describe('carregarImovelCadastroPorNumeroPlanilha', () => {
  beforeEach(() => {
    vi.mocked(request).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('usa fallback da listagem quando montagem completa falha', async () => {
    vi.mocked(request).mockImplementation(async (path) => {
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

  it('não reintroduz id interno como fallback do nº planilha no painel', async () => {
    vi.mocked(request).mockImplementation(async (path) => {
      if (path === '/api/imoveis/por-numero-planilha/6') throw new Error('404');
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
      if (path === '/api/imoveis/21') throw new Error('detalhe indisponível');
      if (path === '/api/imoveis/por-numero-planilha/6/vinculos-processo') {
        return { numeroPlanilha: 6, vinculos: [] };
      }
      if (path === '/api/imoveis/6') throw new Error('não deve buscar id interno 6');
      throw new Error(`unexpected ${path}`);
    });

    const r = await carregarImovelCadastroParaPainel({ imovelId: 6 });
    expect(r.item?.unidade).toBe('Unidade 1803 A');
    expect(request).not.toHaveBeenCalledWith('/api/imoveis/6', expect.anything());
  });

  it.each(CASOS_ARMADILHA)('planilha $planilha carrega unidade correta, não id $idInternoErrado', async (caso) => {
    mockApiParaPlanilha(caso);
    const r = await carregarImovelCadastroParaPainel({ imovelId: caso.planilha });
    expect(r.item?.imovelId).toBe(caso.planilha);
    expect(r.item?.unidade).toBe(caso.unidadeOk);
    expect(r.item?.unidade).not.toBe(caso.idErradoUnidade);
  });
});

describe('carregarImovelCadastro (id interno)', () => {
  beforeEach(() => {
    vi.mocked(request).mockReset();
  });

  it('carrega pelo id interno quando chamado explicitamente (IPTU/Drive)', async () => {
    vi.mocked(request).mockImplementation(async (path) => {
      if (path === '/api/imoveis/21') {
        return {
          id: 21,
          numeroPlanilha: 6,
          situacao: 'OCUPADO',
          unidade: 'Unidade 1803 A',
          camposExtrasJson: '{}',
        };
      }
      if (path === '/api/locacoes/contratos') return [];
      if (path === '/api/imoveis/21/vinculos-processo') return { numeroPlanilha: 6, vinculos: [] };
      throw new Error(`unexpected ${path}`);
    });
    const r = await carregarImovelCadastro({ imovelId: 21 });
    expect(r.item?._apiImovelId).toBe(21);
    expect(r.item?.imovelId).toBe(6);
  });
});

describe('filtrarItensRelatorioPlanilhaAdmin', () => {
  it('aceita nº de planilha acima de 66 (sem teto) e descarta nº inválido', () => {
    const itens = [
      { imovelId: 1, unidade: 'A' },
      { imovelId: 67, unidade: 'B' },
      { imovelId: 120, unidade: 'C' },
      { imovelId: 0, unidade: 'inválido' },
      { imovelId: null, unidade: 'sem nº' },
    ];
    const out = filtrarItensRelatorioPlanilhaAdmin(itens);
    expect(out.map((i) => i.imovelId)).toEqual([1, 67, 120]);
  });
});
