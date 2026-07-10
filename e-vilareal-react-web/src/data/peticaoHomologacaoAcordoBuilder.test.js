import { describe, expect, it } from 'vitest';
import { extrairBoletosHomologacao } from './peticaoHomologacaoAcordoBuilder.js';

describe('peticaoHomologacaoAcordoBuilder', () => {
  it('extrairBoletosHomologacao usa valor total da parcela sem somar honorários', () => {
    const rodada = {
      entradaParcelamentoModo: 'nenhuma',
      quantidadeParcelasInformada: '02',
      parcelas: [
        { dataVencimento: '05/08/2026', valorParcela: '9.082,74', honorariosParcela: '1.513,75' },
        { dataVencimento: '05/09/2026', valorParcela: '9.082,74', honorariosParcela: '1.513,75' },
      ],
    };
    const boletos = extrairBoletosHomologacao(rodada);
    expect(boletos).toHaveLength(2);
    expect(boletos[0].valorParcela).toBe('R$ 9.082,74');
    expect(boletos[1].valorParcela).toBe('R$ 9.082,74');
  });

  it('extrairBoletosHomologacao prioriza parcelasGravadasAceito congeladas ao aceitar', () => {
    const rodada = {
      parcelamentoAceito: true,
      entradaParcelamentoModo: 'nenhuma',
      quantidadeParcelasInformada: '01',
      parcelas: [{ dataVencimento: '05/08/2026', valorParcela: 'R$ 100,00' }],
      parcelasGravadasAceito: [
        { dataVencimento: '05/08/2026', valorParcela: 'R$ 9.082,74' },
        { dataVencimento: '05/09/2026', valorParcela: 'R$ 9.082,74' },
        { dataVencimento: '05/10/2026', valorParcela: 'R$ 9.082,74' },
        { dataVencimento: '05/11/2026', valorParcela: 'R$ 9.082,74' },
      ],
      parcelamentoPlanoAceito: {
        quantidadeParcelasInformada: '04',
        entradaParcelamentoModo: 'nenhuma',
      },
    };
    const boletos = extrairBoletosHomologacao(rodada);
    expect(boletos).toHaveLength(4);
  });
});
