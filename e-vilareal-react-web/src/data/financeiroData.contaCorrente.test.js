import { describe, expect, it } from 'vitest';
import {
  procContaCorrenteDeTransacao,
  transacaoBateProcContaCorrente,
  filtrarLinhasContaCorrenteCliente,
  mapLinhasFinanceiroParaContaCorrenteModal,
} from './financeiroData.js';

describe('procContaCorrenteDeTransacao', () => {
  it('lê proc 0 do marcador grupoCompensacao', () => {
    expect(procContaCorrenteDeTransacao({ proc: '', grupoCompensacao: '0' })).toBe('0');
    expect(procContaCorrenteDeTransacao({ proc: '', _financeiroMeta: { grupoCompensacao: '0' } })).toBe('0');
  });

  it('prefere proc explícito na linha', () => {
    expect(procContaCorrenteDeTransacao({ proc: '12', grupoCompensacao: '0' })).toBe('12');
  });
});

describe('transacaoBateProcContaCorrente', () => {
  it('inclui mensalista com grupo 0', () => {
    expect(
      transacaoBateProcContaCorrente(
        { codCliente: '473', proc: '', grupoCompensacao: '0' },
        '0',
      ),
    ).toBe(true);
  });

  it('inclui lançamento sem processo vinculado no bucket proc 0', () => {
    expect(
      transacaoBateProcContaCorrente({ codCliente: '473', proc: '', processoId: null }, '0'),
    ).toBe(true);
  });

  it('exclui lançamento de outro proc', () => {
    expect(
      transacaoBateProcContaCorrente({ codCliente: '473', proc: '12', processoId: 99 }, '0'),
    ).toBe(false);
  });
});

describe('filtrarLinhasContaCorrenteCliente', () => {
  it('oculta CZ-HON internos e mantém repasse líquido', () => {
    const linhas = [
      { numero: '148946', valor: 259.11, descricao: 'Credito Deposito Judicial' },
      { numero: 'CZ-REP-148946', valor: -207.29, descricao: 'Repasse ao cliente' },
      { numero: 'CZ-HON-148946', valor: 51.82, descricao: 'Honorários 20%' },
    ];
    const filtradas = filtrarLinhasContaCorrenteCliente(linhas);
    expect(filtradas.map((l) => l.numero)).toEqual(['148946', 'CZ-REP-148946']);
    const { lancamentos, soma } = mapLinhasFinanceiroParaContaCorrenteModal(linhas);
    expect(lancamentos).toHaveLength(2);
    expect(soma).toBeCloseTo(51.82, 2);
  });
});
