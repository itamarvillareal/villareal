import { describe, expect, it } from 'vitest';
import {
  aplicarSugestoesSemelhantes,
  chaveValorSemelhante,
  coletarPadroesClassificadosPorValor,
} from './imoveisSugestaoSemelhante.js';
import { PAPEL_ALUGUEL, PAPEL_DEBITO, PAPEL_REPASSE } from './imoveisAdministracaoFinanceiro.js';

const tx = (id, valor, papel = PAPEL_DEBITO) => ({
  apiId: id,
  valor,
  classificacao: { papel, motivo: 'padrao_debito', despesaRepassarAoLocador: false },
});

describe('imoveisSugestaoSemelhante', () => {
  it('agrupa pelo valor com sinal', () => {
    expect(chaveValorSemelhante(-1312)).toBe('-1312.00');
    expect(chaveValorSemelhante(1312)).toBe('1312.00');
    expect(chaveValorSemelhante(0)).toBeNull();
  });

  it('propaga repasse a partir de escolha manual', () => {
    const transacoes = [tx(1, -1312), tx(2, -1312), tx(3, -500)];
    const vinculos = new Map();
    const escolhasManuais = { 1: 'REPASSE' };

    const out = aplicarSugestoesSemelhantes({
      transacoes,
      vinculosPorLancamento: vinculos,
      escolhasManuais,
      descricoesOutros: {},
      classificacoesExtras: {},
    });

    expect(out.aplicadas).toBe(1);
    expect(out.classificacoesExtras[2].papel).toBe(PAPEL_REPASSE);
    expect(out.classificacoesExtras[3]).toBeUndefined();
  });

  it('prioriza vínculo confirmado sobre sugestão existente', () => {
    const transacoes = [
      { apiId: 1, valor: -1312, classificacao: { papel: PAPEL_REPASSE, motivo: 'heuristica' } },
      tx(2, -1312),
    ];
    const vinculos = new Map([[3, { papel: 'ALUGUEL', rotuloClassificacao: null }]]);

    const padroes = coletarPadroesClassificadosPorValor({
      transacoes: [...transacoes, { apiId: 3, valor: -1312, classificacao: { papel: PAPEL_DEBITO } }],
      vinculosPorLancamento: vinculos,
      escolhasManuais: {},
      descricoesOutros: {},
      classificacoesExtras: {},
    });

    expect(padroes.get('-1312.00')?.classificacao.papel).toBe(PAPEL_ALUGUEL);
  });
});
