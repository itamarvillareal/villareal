import { describe, expect, it } from 'vitest';
import {
  agruparFechamentosPorAno,
  agruparFechamentosPorCartao,
  agruparFechamentosPorMes,
  labelMesFechamento,
  linkExtratoFechamentos,
  mesclarCartoesComResumos,
  resumoTotalFechamentos,
  signedValorFechamentoApi,
} from './fechamentoFaturaResumo.js';

describe('fechamentoFaturaResumo', () => {
  const lancamentos = [
    { dataLancamento: '2026-01-15', valor: -100 },
    { dataLancamento: '2026-01-20', valor: -50 },
    { dataLancamento: '2026-02-10', valor: -200 },
    { dataLancamento: '2025-12-01', valor: -75 },
  ];

  it('signedValorFechamentoApi usa valor com sinal da API', () => {
    expect(signedValorFechamentoApi({ valor: -42.5 })).toBe(-42.5);
    expect(signedValorFechamentoApi({ valor: 10 })).toBe(10);
  });

  it('agrupa por mês em ordem decrescente', () => {
    const rows = agruparFechamentosPorMes(lancamentos);
    expect(rows.map((r) => r.chave)).toEqual(['2026-02', '2026-01', '2025-12']);
    expect(rows[0]).toMatchObject({ quantidade: 1, valor: -200 });
    expect(rows[1]).toMatchObject({ quantidade: 2, valor: -150 });
  });

  it('agrupa por ano', () => {
    const rows = agruparFechamentosPorAno(lancamentos);
    expect(rows.map((r) => r.chave)).toEqual(['2026', '2025']);
    expect(rows[0]).toMatchObject({ quantidade: 3, valor: -350 });
    expect(rows[1]).toMatchObject({ quantidade: 1, valor: -75 });
  });

  it('resumo total', () => {
    expect(resumoTotalFechamentos(lancamentos)).toEqual({ quantidade: 4, valor: -425 });
  });

  it('labelMesFechamento', () => {
    expect(labelMesFechamento('2026-07')).toBe('jul/2026');
  });

  it('agrupa por cartão', () => {
    const lista = [
      { cartaoId: 1, cartaoNome: 'Visa', dataLancamento: '2026-01-10', valor: -100 },
      { cartaoId: 2, cartaoNome: 'Master', dataLancamento: '2026-01-15', valor: -200 },
      { cartaoId: 1, cartaoNome: 'Visa', dataLancamento: '2026-02-01', valor: -50 },
    ];
    const rows = agruparFechamentosPorCartao(lista);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.cartaoNome === 'Visa')).toMatchObject({
      total: { quantidade: 2, valor: -150 },
    });
    expect(rows.find((r) => r.cartaoNome === 'Master')).toMatchObject({
      total: { quantidade: 1, valor: -200 },
    });
  });

  it('mescla cartões cadastrados sem fechamento', () => {
    const resumos = agruparFechamentosPorCartao([
      { cartaoId: 1, cartaoNome: 'Visa', dataLancamento: '2026-01-10', valor: -100 },
    ]);
    const merged = mesclarCartoesComResumos(resumos, [
      { id: 1, nome: 'Visa' },
      { id: 2, nome: 'Mastercard' },
    ]);
    expect(merged).toHaveLength(2);
    expect(merged.find((r) => r.cartaoNome === 'Mastercard')).toMatchObject({
      total: { quantidade: 0, valor: 0 },
    });
  });

  it('linkExtratoFechamentos monta query', () => {
    expect(linkExtratoFechamentos({ cartaoId: 3, mes: '2026-07' })).toBe(
      '/financeiro/cartoes/fechamentos?cartaoId=3&mes=2026-07',
    );
  });
});
