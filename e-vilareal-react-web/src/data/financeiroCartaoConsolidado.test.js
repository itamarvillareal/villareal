import { describe, expect, it } from 'vitest';
import {
  valorContabilDesdeExtratoCartao,
  getTransacoesConsolidadas,
  getExtratosIniciais,
  getExtratosCartaoIniciais,
} from './financeiroData.js';

describe('financeiro cartão — inversão só no consolidado', () => {
  it('valorContabilDesdeExtratoCartao inverte sinal da fatura', () => {
    expect(valorContabilDesdeExtratoCartao(235.89)).toBe(-235.89);
    expect(valorContabilDesdeExtratoCartao(-44.91)).toBe(44.91);
  });

  it('getTransacoesConsolidadas mantém fatura no extrato e inverte na conta', () => {
    const bancos = getExtratosIniciais();
    const cartoes = getExtratosCartaoIniciais();
    cartoes.Visa = [
      {
        letra: 'D',
        numero: 'PL-1',
        data: '01/01/2020',
        descricao: 'Compra',
        valor: 100,
        codCliente: '',
        proc: '',
        ref: 'N',
      },
    ];
    const lista = getTransacoesConsolidadas(bancos, 'Conta Veredas', {}, null, cartoes);
    const linha = lista.find((t) => t.descricao === 'Compra');
    expect(linha).toBeTruthy();
    expect(linha.valor).toBe(-100);
    expect(linha.origemExtrato).toBe('cartao');
  });
});
