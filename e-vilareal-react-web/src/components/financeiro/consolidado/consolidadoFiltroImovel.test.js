import { describe, expect, it } from 'vitest';
import {
  lancamentoBateFiltroImovel,
  montarCtxFiltroImovel,
  prefixoObsCodProc,
} from './consolidadoFiltroImovel.js';

describe('consolidadoFiltroImovel', () => {
  it('prefixoObsCodProc concatena cod. sem zeros à esquerda com proc.', () => {
    expect(prefixoObsCodProc('00001157', 9)).toBe('11579');
  });

  it('lancamentoBateFiltroImovel aceita grupo_compensacao', () => {
    const ctx = montarCtxFiltroImovel('57');
    expect(lancamentoBateFiltroImovel({ grupoCompensacao: '57' }, ctx)).toBe(true);
    expect(lancamentoBateFiltroImovel({ grupoCompensacao: '58' }, ctx)).toBe(false);
  });

  it('lancamentoBateFiltroImovel aceita prefixo Cod.+Proc. na Obs', () => {
    const ctx = montarCtxFiltroImovel('57', {
      vinculos: [{ codigoCliente: '00001157', numeroInterno: 9 }],
    });
    expect(
      lancamentoBateFiltroImovel(
        { descricaoDetalhada: '11579 - 1101 C Veredas - 01/2025' },
        ctx,
      ),
    ).toBe(true);
    expect(lancamentoBateFiltroImovel({ descricao: 'FINANC IMOBILIARIO 023/388' }, ctx)).toBe(false);
  });
});
