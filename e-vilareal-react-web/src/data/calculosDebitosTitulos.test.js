import { describe, expect, it } from 'vitest';
import { parseValorMonetarioBr } from '../utils/parseValorMonetarioBr.js';
import {
  calcularTotalTituloGrade,
  enriquecerTitulosAPartirDeDebitosNaRodada,
  mesclarTitulosGravadosComRecalculo,
  tituloFromCamposTaxa,
  titulosGradeTemValor,
} from './calculosDebitosTitulos.js';
import { enriquecerTitulosAPartirDeParcelasNaRodada } from './calculosTitulosParcelasSync.js';

describe('calculosDebitosTitulos', () => {
  it('monta título com totais como Excel (linha 1 cliente 560)', () => {
    const t = tituloFromCamposTaxa({
      dataVencimento: '15/06/2025',
      valor: 'R$ 675,76',
      atualizacaoMonetaria: '20,51',
      diasAtraso: '337',
      juros: '83,55',
      multa: '15,59',
      honorarios: '0,00',
    });
    expect(t.dataVencimento).toBe('15/06/2025');
    expect(t.diasAtraso).toBe('337');
    expect(t.total).toBe('R$ 795,41');
  });

  it('crédito negativo: total negativo (subtrai no rodapé)', () => {
    const t = tituloFromCamposTaxa({
      dataVencimento: '',
      valor: '-1481',
      atualizacaoMonetaria: '',
      juros: '',
      multa: '',
      honorarios: '',
    });
    expect(t.total).toBe('R$ -1.481,00');
    expect(calcularTotalTituloGrade({ valorInicial: 'R$ 795,41' })).toBe('R$ 795,41');
    const soma =
      (parseValorMonetarioBr('R$ 795,41') ?? 0) + (parseValorMonetarioBr(t.total) ?? 0);
    expect(soma).toBeCloseTo(795.41 - 1481, 2);
  });

  it('prioriza debitos sobre parcelas no espelho legado', () => {
    const rodada = {
      debitos: [
        {
          dataVencimento: '15/06/2025',
          valor: '675,76',
          atualizacaoMonetaria: '20,51',
          diasAtraso: '337',
          juros: '83,55',
          multa: '15,59',
          honorarios: '0,00',
        },
      ],
      parcelas: [{ dataVencimento: '05/06/2026', valorParcela: 'R$ 816,77' }],
      titulos: [],
    };
    const out = enriquecerTitulosAPartirDeParcelasNaRodada(rodada);
    expect(titulosGradeTemValor(out.titulos)).toBe(true);
    expect(out.titulos[0].dataVencimento).toBe('15/06/2025');
    expect(out.titulos[0].valorInicial).toContain('675');
    expect(out.titulos).toHaveLength(1);
  });

  it('calcularTotalTituloGrade soma componentes', () => {
    expect(
      calcularTotalTituloGrade({
        valorInicial: 'R$ 100,00',
        atualizacaoMonetaria: 'R$ 10,00',
        juros: 'R$ 5,00',
        multa: 'R$ 2,00',
        honorarios: 'R$ 0,00',
      })
    ).toBe('R$ 117,00');
  });

  it('mesclarTitulosGravadosComRecalculo: encargos do recálculo, vencimento/valor do txt', () => {
    const map = (lista) => lista;
    const merged = mesclarTitulosGravadosComRecalculo(
      [
        { valorInicial: 'R$ 100,00', juros: 'R$ 10,00', dataVencimento: '01/01/2020' },
        { valorInicial: 'R$ 200,00', dataVencimento: '01/02/2020' },
      ],
      [
        { valorInicial: 'R$ 999,00', juros: 'R$ 99,00', multa: 'R$ 1,00' },
        { valorInicial: 'R$ 200,00', juros: 'R$ 50,00', multa: 'R$ 4,00' },
      ],
      map,
    );
    expect(merged[0].valorInicial).toBe('R$ 100,00');
    expect(merged[0].dataVencimento).toBe('01/01/2020');
    expect(merged[0].juros).toBe('R$ 99,00');
    expect(merged[1].juros).toBe('R$ 50,00');
  });
});
