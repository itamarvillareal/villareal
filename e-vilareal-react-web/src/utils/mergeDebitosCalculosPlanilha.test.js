import { describe, expect, it } from 'vitest';
import {
  mergeDebitosCalculosMultiSheet,
  mergeDebitosCalculosPlanilha,
  migrarRodadasLegadoParaSequenciaCompacta,
} from './mergeDebitosCalculosPlanilha.js';

describe('mergeDebitosCalculosPlanilha', () => {
  it('retorna aviso se só cabeçalho', () => {
    const { nextRodadas, stats } = mergeDebitosCalculosPlanilha({}, [['A', 'B', 'C']]);
    expect(stats.linhasLidas).toBe(0);
    expect(stats.aplicadas).toBe(0);
    expect(nextRodadas).toEqual({});
  });

  it('cria rodada e preenche primeira parcela (data texto BR e valor)', () => {
    const matrix = [
      ['cod', 'venc', 'valor', 'D', 'E', 'F', 'proc', 'dim'],
      [1, '15/03/2026', 100.5, '', '', '', 35, 0],
    ];
    const { nextRodadas, stats } = mergeDebitosCalculosPlanilha({}, matrix);
    expect(stats.aplicadas).toBe(1);
    const key = '00000001:35:0';
    expect(nextRodadas[key]).toBeTruthy();
    expect(nextRodadas[key].parcelas[0].dataVencimento).toBe('15/03/2026');
    expect(nextRodadas[key].parcelas[0].valorParcela).toMatch(/R\$\s*100,50/);
    expect(nextRodadas[key].quantidadeParcelasInformada).toBe('01');
  });

  it('aceita serial Excel na coluna B', () => {
    const matrix = [
      ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
      [2, 45321, 10, '', '', '', 40, 1],
    ];
    const { nextRodadas, stats } = mergeDebitosCalculosPlanilha({}, matrix);
    expect(stats.aplicadas).toBe(1);
    const key = '00000002:40:1';
    expect(nextRodadas[key].parcelas[0].dataVencimento).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  it('mesma chave: cada linha ocupa o próximo slot de parcela/título', () => {
    const matrix = [
      ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
      [1, '01/01/2026', 1, '', '', '', 10, 0],
      [1, '02/02/2026', 2, '', '', '', 10, 0],
    ];
    const { nextRodadas, stats } = mergeDebitosCalculosPlanilha({}, matrix);
    expect(stats.aplicadas).toBe(2);
    const key = '00000001:10:0';
    expect(nextRodadas[key].parcelas[0].dataVencimento).toBe('01/01/2026');
    expect(nextRodadas[key].parcelas[0].valorParcela).toContain('1,00');
    expect(nextRodadas[key].parcelas[1].dataVencimento).toBe('02/02/2026');
    expect(nextRodadas[key].parcelas[1].valorParcela).toContain('2,00');
  });

  it('merge multi-folha: segunda folha sem cabeçalho explícito ainda importa linha', () => {
    const m1 = [
      ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
      [1, '01/01/2026', 1, '', '', '', 10, 0],
    ];
    const m2 = [[722, '10/10/2026', 99, '', '', '', 5, 0]];
    const { nextRodadas, stats } = mergeDebitosCalculosMultiSheet({}, [m1, m2]);
    expect(stats.sheetsUsadas).toBe(2);
    expect(nextRodadas['00000722:5:0'].parcelas[0].dataVencimento).toBe('10/10/2026');
    expect(nextRodadas['00000001:10:0']).toBeTruthy();
  });

  it('mantém cabeçalho e espelha data/valor da planilha em parcelas e titulos (slot 0)', () => {
    const base = {
      '00000001:10:0': {
        pagina: 1,
        paginaParcelamento: 1,
        titulos: [{ dataVencimento: '10/01/2020', valorInicial: 'R$ 1,00', atualizacaoMonetaria: '', diasAtraso: '', juros: '', multa: '', honorarios: '', total: '', descricaoValor: '' }],
        parcelas: [{ dataVencimento: '', valorParcela: '', honorariosParcela: '', observacao: '', dataPagamento: '' }],
        quantidadeParcelasInformada: '00',
        taxaJurosParcelamento: '0,00',
        limpezaAtiva: false,
        snapshotAntesLimpeza: null,
        cabecalho: { autor: 'X', reu: 'Y' },
        honorariosDataRecebimento: {},
        parcelamentoAceito: false,
      },
    };
    const matrix = [['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], [1, '05/05/2026', 99, '', '', '', 10, 0]];
    const { nextRodadas } = mergeDebitosCalculosPlanilha(base, matrix);
    expect(nextRodadas['00000001:10:0'].cabecalho).toEqual({ autor: 'X', reu: 'Y' });
    expect(nextRodadas['00000001:10:0'].titulos[0].valorInicial).toBe('R$ 99,00');
    expect(nextRodadas['00000001:10:0'].parcelas[0].dataVencimento).toBe('05/05/2026');
  });

  it('stub legado (proc na API sem rodada) → sequência compacta', () => {
    const matrix = [
      ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
      [299, '15/03/2026', 100, '', '', '', 1474, 0],
    ];
    const numerosInternosPorCliente8 = {
      '00000299': [...Array.from({ length: 74 }, (_, i) => i + 1), 1474],
    };
    const { nextRodadas, stats } = mergeDebitosCalculosPlanilha({}, matrix, { numerosInternosPorCliente8 });
    expect(stats.aplicadas).toBe(1);
    expect(nextRodadas['00000299:75:0']).toBeTruthy();
    expect(nextRodadas['00000299:1474:0']).toBeFalsy();
    expect(stats.avisos.some((a) => a.includes('1474') && a.includes('75'))).toBe(true);
  });

  it('mesmo proc legado em duas linhas mantém o mesmo destino compacto', () => {
    const matrix = [
      ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
      [299, '01/01/2026', 10, '', '', '', 1474, 0],
      [299, '02/02/2026', 20, '', '', '', 1474, 0],
    ];
    const numerosInternosPorCliente8 = {
      '00000299': [...Array.from({ length: 74 }, (_, i) => i + 1), 1474],
    };
    const { nextRodadas, stats } = mergeDebitosCalculosPlanilha({}, matrix, { numerosInternosPorCliente8 });
    expect(stats.aplicadas).toBe(2);
    const r = nextRodadas['00000299:75:0'];
    expect(r.parcelas[0].valorParcela).toContain('10,00');
    expect(r.parcelas[1].valorParcela).toContain('20,00');
  });

  it('migra rodada existente no proc legado 1474 para 75', () => {
    const base = {
      '00000299:1474:0': {
        pagina: 1,
        paginaParcelamento: 1,
        titulos: [
          {
            dataVencimento: '15/03/2026',
            valorInicial: 'R$ 100,00',
            atualizacaoMonetaria: '',
            diasAtraso: '',
            juros: '',
            multa: '',
            honorarios: '',
            total: '',
            descricaoValor: '',
          },
        ],
        parcelas: [
          {
            dataVencimento: '15/03/2026',
            valorParcela: 'R$ 100,00',
            honorariosParcela: '',
            observacao: '',
            dataPagamento: '',
          },
        ],
        quantidadeParcelasInformada: '01',
        taxaJurosParcelamento: '0,00',
        limpezaAtiva: false,
        snapshotAntesLimpeza: null,
        cabecalho: { autor: 'Condomínio', reu: '' },
        honorariosDataRecebimento: {},
        parcelamentoAceito: false,
      },
    };
    const avisos = [];
    const out = migrarRodadasLegadoParaSequenciaCompacta(base, {
      '00000299': [...Array.from({ length: 74 }, (_, i) => i + 1), 1474],
    }, avisos);
    expect(out['00000299:75:0']).toBeTruthy();
    expect(out['00000299:1474:0']).toBeFalsy();
    expect(out['00000299:75:0'].parcelas[0].valorParcela).toContain('100,00');
    expect(avisos.some((a) => a.includes('1474') && a.includes('75'))).toBe(true);
  });
});
