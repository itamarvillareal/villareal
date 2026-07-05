import { describe, expect, it } from 'vitest';
import { ETAPAS } from '../constants/financeiroConstants.js';
import { LETRAS_MODO_INCLUIR } from './extratoLetrasFiltro.js';
import {
  filtroCompensacaoSemParAtivo,
  linhaSemParCompensacao,
} from './compensacaoSemPar.js';

describe('compensacaoSemPar', () => {
  it('linhaSemParCompensacao só conta E não compensada', () => {
    expect(linhaSemParCompensacao({ contaCodigo: 'E', etapa: ETAPAS.IMPORTADO })).toBe(true);
    expect(linhaSemParCompensacao({ contaCodigo: 'E', etapa: ETAPAS.CLASSIFICADO })).toBe(true);
    expect(linhaSemParCompensacao({ contaCodigo: 'E', etapa: ETAPAS.COMPENSADO })).toBe(false);
    expect(linhaSemParCompensacao({ contaCodigo: 'A', etapa: ETAPAS.IMPORTADO })).toBe(false);
  });

  it('filtroCompensacaoSemParAtivo: Somente E + Pendente', () => {
    expect(
      filtroCompensacaoSemParAtivo({
        letras: ['E'],
        letrasModo: LETRAS_MODO_INCLUIR,
        etapa: ETAPAS.IMPORTADO,
      }),
    ).toBe(true);
    expect(
      filtroCompensacaoSemParAtivo({
        letras: ['E', 'A'],
        letrasModo: LETRAS_MODO_INCLUIR,
        etapa: ETAPAS.IMPORTADO,
      }),
    ).toBe(false);
  });
});
