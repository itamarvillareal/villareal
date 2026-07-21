import { describe, expect, it } from 'vitest';
import { mapaRodadasTemValorTituloOuParcela } from './calculosRodadasStorage.js';

describe('mapaRodadasTemValorTituloOuParcela', () => {
  it('aceita rodada com panelConfig (multa/honorários/índice) sem títulos preenchidos', () => {
    const ok = mapaRodadasTemValorTituloOuParcela({
      '00000001:1:0': {
        titulos: [],
        parcelas: [],
        panelConfig: { multa: '2 %', honorariosValor: '10 %', indice: 'IPCA' },
      },
    });
    expect(ok).toBe(true);
  });

  it('aceita cálculo aceito com snapshot em titulosGravadosAceito', () => {
    const ok = mapaRodadasTemValorTituloOuParcela({
      '00000001:1:0': {
        parcelamentoAceito: true,
        titulos: [],
        titulosGravadosAceito: [{ valorInicial: 'R$ 100,00' }],
        panelConfig: { multa: '2 %', indice: 'INPC' },
      },
    });
    expect(ok).toBe(true);
  });

  it('rejeita stub vazio sem panelConfig', () => {
    const ok = mapaRodadasTemValorTituloOuParcela({
      '00000001:1:0': { titulos: [], parcelas: [], panelConfig: null },
    });
    expect(ok).toBe(false);
  });
});
