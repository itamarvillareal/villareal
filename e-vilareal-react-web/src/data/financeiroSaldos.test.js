import { describe, expect, it } from 'vitest';
import {
  getSaldosPorInstituicaoFinanceiro,
  somarValoresLancamentosFinanceiro,
} from './financeiroData.js';

describe('financeiro saldos resumo', () => {
  it('soma valores do extrato', () => {
    expect(somarValoresLancamentosFinanceiro([{ valor: 10 }, { valor: -3 }])).toBe(7);
  });

  it('agrupa saldo por instituição', () => {
    const extratos = {
      Itaú: [{ valor: 100 }, { valor: -40 }],
      CORA: [{ valor: 50 }],
    };
    const linhas = getSaldosPorInstituicaoFinanceiro(extratos, {
      ordemNomes: ['Itaú', 'CORA'],
      numeroPorBanco: { Itaú: 1, CORA: 26 },
      incluirSemMovimento: true,
    });
    const itau = linhas.find((l) => l.nome === 'Itaú');
    expect(itau?.saldo).toBe(60);
    expect(itau?.count).toBe(2);
  });
});
