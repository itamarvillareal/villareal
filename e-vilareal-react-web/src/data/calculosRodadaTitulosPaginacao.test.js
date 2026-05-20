import { describe, expect, it } from 'vitest';
import {
  garantirArrayTitulosTamanho,
  mesclarTitulosPaginaNoArray,
  resumoTitulosFromApi,
} from './calculosRodadaTitulosPaginacao.js';

describe('calculosRodadaTitulosPaginacao', () => {
  it('mesclarTitulosPaginaNoArray coloca página 2 no offset 20', () => {
    const base = garantirArrayTitulosTamanho([], 40);
    const merged = mesclarTitulosPaginaNoArray(
      base,
      [{ valorInicial: 'R$ 1,00', dataVencimento: '01/01/2020' }],
      2,
      20
    );
    expect(merged[20].valorInicial).toBe('R$ 1,00');
    expect(merged[0].valorInicial).toBe('');
  });

  it('resumoTitulosFromApi formata totais', () => {
    const r = resumoTitulosFromApi({
      quantidadeTitulos: 3,
      totalValorInicial: 100,
      totalJuros: 83.55,
      totalMulta: 15.59,
      totalAtualizacao: 20.51,
      totalHonorarios: 0,
      totalGeral: 795.41,
      totalDiasAtraso: 337,
    });
    expect(r.qtd).toContain('03');
    expect(r.juros).toContain('83,55');
    expect(r.total).toContain('795,41');
  });
});
