import { describe, expect, it, vi } from 'vitest';
import {
  enriquecerLinhaProcessoVinculoFinanceiro,
  filtrarProcessosVinculoPasso2,
  pareceTermoBuscaCnj,
  prepararIndiceBuscaProcessoVinculo,
  processoCorrespondeFiltroPasso2,
  buscarParesClienteProcPorTexto,
} from './buscaClienteProcFinanceiro.js';

vi.mock('./processosHistoricoData.js', () => ({
  obterParteOpostaUnificada: (_cod, proc, fb) =>
    Number(proc) === 12 ? 'DANIELA DOS SANTOS TAVARES' : String(fb ?? ''),
  obterNumeroProcessoNovoUnificado: (_c, _p, fb) => fb,
  obterNumeroProcessoVelhoUnificado: (_c, _p, fb) => fb,
  obterDescricaoAcaoUnificada: (_c, _p, fb) => fb,
  listarRegistrosProcessosHistoricoNormalizados: () => [
    {
      codCliente: '00000966',
      proc: 12,
      cliente: 'ANGELIM REPRESENTAÇÕES LTDA',
      parteCliente: 'ANGELIM REPRESENTAÇÕES LTDA',
      parteOposta: 'DANIELA DOS SANTOS TAVARES',
      numeroProcessoNovo: '',
      numeroProcessoVelho: '',
      naturezaAcao: 'ADMINISTRAÇÃO DE IMÓVEL',
    },
    {
      codCliente: '00000426',
      proc: 34,
      cliente: 'CLIENTE TESTE',
      parteCliente: 'AUTOR TESTE',
      parteOposta: 'RÉU TESTE',
      numeroProcessoNovo: '5319281-62.2022.8.09.0007',
      numeroProcessoVelho: '',
      naturezaAcao: 'COBRANÇA',
    },
    {
      codCliente: '00000533',
      proc: 10,
      cliente: 'CLIENTE 533',
      parteCliente: 'AUTOR 533',
      parteOposta: 'RÉU 533',
      numeroProcessoNovo: '025658.89.2017.8.09.0006',
      numeroProcessoVelho: '',
      naturezaAcao: 'TRABALHISTA',
    },
  ],
}));

describe('processoCorrespondeFiltroPasso2', () => {
  const linha = {
    numeroInterno: 12,
    parteOposta: 'DANIELA DOS SANTOS TAVARES',
    numeroProcessoNovo: '',
    numeroProcessoVelho: '',
    observacao: 'ADMINISTRAÇÃO DE IMÓVEL',
    parteClienteAutor: 'ANGELIM REPRESENTAÇÕES LTDA',
  };

  it('encontra parte oposta por trecho do nome', () => {
    expect(processoCorrespondeFiltroPasso2(linha, 'ANGELIM', 'tavares')).toBe(true);
    expect(processoCorrespondeFiltroPasso2(linha, 'ANGELIM', 'tavare')).toBe(true);
  });

  it('não filtra quando réu vazio e termo só bate no histórico ausente na linha', () => {
    expect(
      processoCorrespondeFiltroPasso2({ ...linha, parteOposta: '' }, 'ANGELIM', 'tavares')
    ).toBe(false);
  });

  it('sem termo retorna todos', () => {
    expect(processoCorrespondeFiltroPasso2(linha, 'ANGELIM', '')).toBe(true);
  });
});

describe('prepararIndiceBuscaProcessoVinculo', () => {
  it('filtrarProcessosVinculoPasso2 usa índice sem divergir do filtro legado', () => {
    const linha = prepararIndiceBuscaProcessoVinculo(
      {
        numeroInterno: 12,
        parteOposta: 'DANIELA DOS SANTOS TAVARES',
        numeroProcessoNovo: '',
        numeroProcessoVelho: '',
        observacao: 'ADMINISTRAÇÃO DE IMÓVEL',
        parteClienteAutor: 'ANGELIM REPRESENTAÇÕES LTDA',
      },
      'ANGELIM'
    );
    const filtrados = filtrarProcessosVinculoPasso2([linha], 'ANGELIM', 'tavares');
    expect(filtrados).toHaveLength(1);
    expect(processoCorrespondeFiltroPasso2(linha, 'ANGELIM', 'tavares')).toBe(true);
  });
});

describe('enriquecerLinhaProcessoVinculoFinanceiro', () => {
  it('preenche parte oposta a partir do histórico local quando a API vem vazia', () => {
    const out = enriquecerLinhaProcessoVinculoFinanceiro(
      { numeroInterno: 12, parteOposta: '', codigoCliente: '00000966' },
      '00000966'
    );
    expect(out.parteOposta).toBe('DANIELA DOS SANTOS TAVARES');
  });
});

describe('filtrarProcessosVinculoPasso2 fallback histórico', () => {
  it('encontra proc. 12 por tavares mesmo com parte oposta vazia na linha da grade', () => {
    const linha = prepararIndiceBuscaProcessoVinculo(
      {
        numeroInterno: 12,
        parteOposta: '',
        numeroProcessoNovo: '',
        numeroProcessoVelho: '',
        observacao: '',
        parteClienteAutor: 'ANGELIM REPRESENTAÇÕES LTDA',
      },
      'ANGELIM'
    );
    expect(processoCorrespondeFiltroPasso2(linha, 'ANGELIM', 'tavares')).toBe(false);
    const filtrados = filtrarProcessosVinculoPasso2([linha], 'ANGELIM', 'tavares', '00000966');
    expect(filtrados).toHaveLength(1);
    expect(String(filtrados[0].numeroInterno)).toBe('12');
  });
});

describe('pareceTermoBuscaCnj', () => {
  it('detecta CNJ com pontos ou só dígitos', () => {
    expect(pareceTermoBuscaCnj('5319281-62.2022.8.09.0007')).toBe(true);
    expect(pareceTermoBuscaCnj('5319281622028090007')).toBe(true);
    expect(pareceTermoBuscaCnj('5319281')).toBe(true);
    expect(pareceTermoBuscaCnj('12')).toBe(false);
    expect(pareceTermoBuscaCnj('João')).toBe(false);
  });
});

describe('buscarParesClienteProcPorTexto CNJ', () => {
  it('encontra processo pelo número CNJ no histórico local', () => {
    const hits = buscarParesClienteProcPorTexto('5319281-62.2022.8.09.0007');
    expect(hits.some((h) => h.codCliente === '426' && h.proc === '34')).toBe(true);
  });

  it('encontra 533/10 com CNJ só dígitos (20) ou legado com pontos (19)', () => {
    const soDigitos = buscarParesClienteProcPorTexto('00256588920178090006');
    expect(soDigitos.some((h) => h.codCliente === '533' && h.proc === '10')).toBe(true);
    const formatado = buscarParesClienteProcPorTexto('0025658-89.2017.8.09.0006');
    expect(formatado.some((h) => h.codCliente === '533' && h.proc === '10')).toBe(true);
    const legado = buscarParesClienteProcPorTexto('025658.89.2017.8.09.0006');
    expect(legado.some((h) => h.codCliente === '533' && h.proc === '10')).toBe(true);
  });
});
