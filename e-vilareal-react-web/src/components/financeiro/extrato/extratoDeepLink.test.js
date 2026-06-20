import { describe, expect, it, vi } from 'vitest';
import {
  buildCartaoUrlParaLancamento,
  buildExtratoUrlParaLancamento,
  mesAnoFromDataBr,
  navegarExtratoSemelhanteItem,
  numeroCartaoFromRow,
  paginaDoLancamentoNaLista,
} from './extratoDeepLink.js';

describe('extratoDeepLink', () => {
  it('monta URL com banco, mês e id do lançamento', () => {
    expect(mesAnoFromDataBr('18/05/2024')).toBe('2024-05');
    expect(
      buildExtratoUrlParaLancamento({
        lancamentoId: 69421,
        numeroBanco: 26,
        data: '18/05/2024',
      }),
    ).toBe('/financeiro/extrato?lancamento=69421&banco=26&mes=2024-05');
  });

  it('aceita data ISO para o mês', () => {
    expect(
      buildExtratoUrlParaLancamento({
        lancamentoId: 100,
        numeroBanco: 30,
        data: '2024-11-22',
      }),
    ).toBe('/financeiro/extrato?lancamento=100&banco=30&mes=2024-11');
  });

  it('redireciona número de cartão para URL do cartão', () => {
    expect(
      buildExtratoUrlParaLancamento({
        lancamentoId: 17302,
        numeroBanco: 19,
        data: '2026-06-12',
      }),
    ).toBe('/financeiro/cartao/19?lancamento=17302&mes=2026-06');
  });

  it('monta URL do cartão', () => {
    expect(
      buildCartaoUrlParaLancamento({
        lancamentoId: 17302,
        numeroCartao: 19,
        mes: '2026-06',
      }),
    ).toBe('/financeiro/cartao/19?lancamento=17302&mes=2026-06');
  });

  it('detecta cartão na linha do inbox', () => {
    expect(numeroCartaoFromRow({ numeroBanco: 19, id: 1 })).toBe(19);
    expect(numeroCartaoFromRow({ numeroBanco: 26, id: 1 })).toBeNull();
  });

  it('calcula página do lançamento', () => {
    const lista = [{ id: 1 }, { id: 2 }, { id: 3 }];
    expect(paginaDoLancamentoNaLista(lista, 3, 2)).toBe(1);
    expect(paginaDoLancamentoNaLista(lista, 99, 2)).toBeNull();
  });

  it('monta URL a partir de item semelhante do inbox Escritório', () => {
    const navigate = vi.fn();
    navegarExtratoSemelhanteItem(
      navigate,
      { lancamentoId: 42, dataLancamento: '2026-03-26' },
      { numeroBanco: 26 },
    );
    expect(navigate).toHaveBeenCalledWith(
      '/financeiro/extrato?lancamento=42&banco=26&mes=2026-03',
    );
  });
});
