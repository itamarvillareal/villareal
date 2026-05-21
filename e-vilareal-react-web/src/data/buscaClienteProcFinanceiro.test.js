import { describe, expect, it, vi } from 'vitest';
import {
  enriquecerLinhaProcessoVinculoFinanceiro,
  filtrarProcessosVinculoPasso2,
  prepararIndiceBuscaProcessoVinculo,
  processoCorrespondeFiltroPasso2,
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
