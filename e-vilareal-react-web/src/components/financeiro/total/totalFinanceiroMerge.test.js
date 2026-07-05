import { describe, expect, it } from 'vitest';
import {
  extratoRowKey,
  filtrarLinhasTotal,
  mesclarLinhasTotal,
  origemExtratoLabel,
  paginarLinhasTotal,
} from './totalFinanceiroMerge.js';

describe('totalFinanceiroMerge', () => {
  it('extratoRowKey distingue banco e cartão com mesmo id', () => {
    expect(extratoRowKey({ id: 1, origemExtrato: 'banco' })).toBe('banco:1');
    expect(extratoRowKey({ id: 1, origemExtrato: 'cartao' })).toBe('cartao:1');
  });

  it('origemExtratoLabel usa nome do cartão ou banco', () => {
    expect(origemExtratoLabel({ origemExtrato: 'cartao', cartaoNome: 'Visa' })).toBe('Visa');
    expect(origemExtratoLabel({ bancoNome: 'Itaú' })).toBe('Itaú');
  });

  it('mescla e ordena por data desc', () => {
    const merged = mesclarLinhasTotal(
      [{ id: 1, origemExtrato: 'banco', dataLancamento: '2026-01-01' }],
      [{ id: 2, origemExtrato: 'cartao', dataLancamento: '2026-02-01' }],
    );
    expect(merged.map((r) => r.id)).toEqual([2, 1]);
  });

  it('filtra por busca e etapa', () => {
    const linhas = [
      { id: 1, etapa: 'IMPORTADO', descricao: 'PIX', bancoNome: 'CORA' },
      { id: 2, etapa: 'FECHADO', descricao: 'Aluguel', cartaoNome: 'Visa', origemExtrato: 'cartao' },
    ];
    expect(filtrarLinhasTotal(linhas, { etapa: 'IMPORTADO' })).toHaveLength(1);
    expect(filtrarLinhasTotal(linhas, { busca: 'visa' })).toHaveLength(1);
    expect(
      filtrarLinhasTotal(
        [
          { id: 1, contaCodigo: 'E', etapa: 'IMPORTADO', descricao: 'x' },
          { id: 2, contaCodigo: 'E', etapa: 'COMPENSADO', descricao: 'y' },
          { id: 3, contaCodigo: 'A', etapa: 'IMPORTADO', descricao: 'z' },
        ],
        { semParCompensacao: true },
      ).map((r) => r.id),
    ).toEqual([1]);
  });

  it('pagina resultado mesclado', () => {
    const linhas = Array.from({ length: 5 }, (_, i) => ({ id: i + 1 }));
    const page = paginarLinhasTotal(linhas, { page: 1, size: 2 });
    expect(page.content.map((r) => r.id)).toEqual([3, 4]);
    expect(page.totalElements).toBe(5);
    expect(page.totalPages).toBe(3);
  });
});
