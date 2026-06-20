import { describe, expect, it } from 'vitest';
import {
  procContaCorrenteDeTransacao,
  transacaoBateProcContaCorrente,
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
