import { describe, expect, it } from 'vitest';
import { mergeDebitosCalculosMultiSheet, mergeDebitosCalculosPlanilha } from './mergeDebitosCalculosPlanilha.js';

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

  it('última linha vence para mesma chave', () => {
    const matrix = [
      ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
      [1, '01/01/2026', 1, '', '', '', 10, 0],
      [1, '02/02/2026', 2, '', '', '', 10, 0],
    ];
    const { nextRodadas, stats } = mergeDebitosCalculosPlanilha({}, matrix);
    expect(stats.aplicadas).toBe(2);
    const key = '00000001:10:0';
    expect(nextRodadas[key].parcelas[0].dataVencimento).toBe('02/02/2026');
    expect(nextRodadas[key].parcelas[0].valorParcela).toContain('2,00');
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

  it('preserva titulos ao atualizar rodada existente', () => {
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
    expect(nextRodadas['00000001:10:0'].titulos[0].valorInicial).toBe('R$ 1,00');
    expect(nextRodadas['00000001:10:0'].parcelas[0].dataVencimento).toBe('05/05/2026');
  });
});
