import { describe, expect, it } from 'vitest';
import {
  PAPEL_ENTRADA,
  PAPEL_PAGAMENTO,
  aplicarNumeroVinculoDescricao,
  aplicarTagPapelDescricao,
  atribuirNumeroVinculoLancamentos,
  classificarLancamentoContaCorrenteProcesso,
  montarPainelResultadoContaCorrenteProcesso,
  removerTagsCcProc,
} from './contaCorrenteProcessoResultado.js';

describe('contaCorrenteProcessoResultado', () => {
  it('classifica depósito judicial como entrada e PIX como pagamento', () => {
    const entrada = classificarLancamentoContaCorrenteProcesso({
      descricao: 'Credito Deposito Judicial',
      valor: 12987.94,
    });
    const pagamento = classificarLancamentoContaCorrenteProcesso({
      descricao: 'PIX TRANSF ANGELIM',
      valor: -10390.35,
    });
    expect(entrada.papel).toBe(PAPEL_ENTRADA);
    expect(pagamento.papel).toBe(PAPEL_PAGAMENTO);
  });

  it('lucro do processo é a soma algébrica dos lançamentos classificados', () => {
    const painel = montarPainelResultadoContaCorrenteProcesso(
      [
        { descricao: 'Credito Deposito Judicial', valor: 12987.94, data: '12/02/2026', numero: '1', nomeBanco: 'BB' },
        { descricao: 'PIX TRANSF', valor: -10390.35, data: '19/05/2026', numero: '2', nomeBanco: 'BB' },
      ],
      '966',
      '12',
    );
    expect(painel.lucroProcesso).toBeCloseTo(2597.59, 2);
    expect(painel.totalEntrada).toBeCloseTo(12987.94, 2);
    expect(painel.totalPagamento).toBeCloseTo(10390.35, 2);
  });

  it('aplica e remove tags na descrição detalhada', () => {
    const comTag = aplicarTagPapelDescricao('Parte A x Parte B', PAPEL_ENTRADA);
    expect(comTag).toContain('[CC_PROC:ENTRADA]');
    expect(removerTagsCcProc(comTag)).toBe('Parte A x Parte B');
  });

  it('sugere par entrada + pagamento sem vínculo', () => {
    const painel = montarPainelResultadoContaCorrenteProcesso(
      [
        { descricao: 'Credito Deposito Judicial', valor: 12987.94, data: '12/02/2026', numero: '1', nomeBanco: 'BB' },
        { descricao: 'PIX TRANSF', valor: -10390.35, data: '19/05/2026', numero: '2', nomeBanco: 'BB' },
      ],
      '966',
      '12',
    );
    expect(painel.paresSugeridos.length).toBeGreaterThanOrEqual(1);
    expect(painel.proximoNumeroVinculo).toBe('1');
  });

  it('lê o mesmo número de vínculo na tag dos lançamentos', () => {
    const painel = montarPainelResultadoContaCorrenteProcesso(
      [
        {
          descricao: 'Credito',
          valor: 100,
          data: '12/02/2026',
          numero: '1',
          nomeBanco: 'BB',
          descricaoDetalhada: 'Parte A x B [CC_VINC:7]',
        },
        {
          descricao: 'PIX',
          valor: -40,
          data: '19/05/2026',
          numero: '2',
          nomeBanco: 'BB',
          descricaoDetalhada: '[CC_VINC:7]',
        },
      ],
      '966',
      '12',
    );
    expect(painel.transacoes[0].numeroVinculo).toBe('7');
    expect(painel.transacoes[1].numeroVinculo).toBe('7');
    const comVinc = aplicarNumeroVinculoDescricao('obs', '7');
    expect(comVinc).toContain('[CC_VINC:7]');
  });
});
