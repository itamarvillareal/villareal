import { describe, expect, it } from 'vitest';
import {
  aplicarUmParCompensacaoInterbancaria,
  detectarParesCompensacao,
} from './financeiroData.js';

describe('compensação — mesmo banco', () => {
  const extratos = {
    Itaú: [
      {
        numero: '1',
        data: '10/03/2024',
        valor: -500,
        descricao: 'DOC emprestimo',
        letra: 'N',
        proc: '',
      },
      {
        numero: '2',
        data: '10/03/2024',
        valor: 500,
        descricao: 'DOC devolucao',
        letra: 'N',
        proc: '',
      },
    ],
  };

  it('detecta par no mesmo banco', () => {
    const pares = detectarParesCompensacao(extratos, { incluirMesmoBanco: true });
    expect(pares).toHaveLength(1);
    expect(pares[0].mesmoBanco).toBe(true);
  });

  it('aplica par no mesmo banco (letra E)', () => {
    const par = detectarParesCompensacao(extratos, { incluirMesmoBanco: true })[0];
    const r = aplicarUmParCompensacaoInterbancaria(extratos, par);
    expect(r.ok).toBe(true);
    expect(r.extratos.Itaú.every((t) => t.letra === 'E')).toBe(true);
  });
});
