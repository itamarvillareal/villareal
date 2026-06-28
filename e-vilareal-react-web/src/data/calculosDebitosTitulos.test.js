import { describe, expect, it } from 'vitest';
import { parseValorMonetarioBr } from '../utils/parseValorMonetarioBr.js';
import {
  calcularTotalTituloGrade,
  enriquecerTitulosAPartirDeDebitosNaRodada,
  mesclarTitulosGravadosComRecalculo,
  patchRodadaAoAceitarPagamento,
  patchRodadaAoDesfazerAceitarPagamento,
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

  it('patchRodadaAoAceitarPagamento: prioriza títulos recalculados no estado', () => {
    const patch = patchRodadaAoAceitarPagamento(
      {
        titulosGravadosAceito: [
          { valorInicial: 'R$ 100,00', dataVencimento: '01/01/2020', juros: 'R$ 1,00' },
        ],
        titulos: [
          {
            valorInicial: 'R$ 100,00',
            dataVencimento: '01/01/2020',
            juros: 'R$ 99,00',
            total: 'R$ 199,00',
          },
        ],
      },
      '23/06/2026',
    );
    expect(patch.titulosGravadosAceito?.[0].juros).toBe('R$ 99,00');
    expect(patch.titulos?.[0].juros).toBe('R$ 99,00');
    expect(patch.dataCalculoRodada).toBe('23/06/2026');
  });

  it('patchRodadaAoDesfazerAceitarPagamento: preserva débitos e apaga só o plano de pagamento', () => {
    const patch = patchRodadaAoDesfazerAceitarPagamento({
      parcelamentoAceito: true,
      titulos: [
        { valorInicial: 'R$ 100,00', dataVencimento: '01/01/2020', juros: 'R$ 9,00' },
        { valorInicial: 'R$ 200,00', dataVencimento: '01/02/2020', juros: 'R$ 8,00' },
      ],
      titulosGravadosAceito: [
        { valorInicial: 'R$ 100,00', dataVencimento: '01/01/2020' },
        { valorInicial: 'R$ 200,00', dataVencimento: '01/02/2020' },
      ],
      parcelas: [{ valorParcela: 'R$ 50,00', dataVencimento: '01/02/2026' }],
      quantidadeParcelasInformada: '12',
      taxaJurosParcelamento: '1,50',
      paginaParcelamento: 3,
      honorariosDataRecebimento: { 'titulo:0': '01/03/2026', 'parcela:0': '02/03/2026' },
    });
    // Destrava e remove o snapshot congelado, mas PRESERVA os débitos (vencimento/valor) em `titulos`.
    expect(patch.parcelamentoAceito).toBe(false);
    expect(patch.titulosGravadosAceito).toEqual([]);
    expect(patch.titulos).toHaveLength(2);
    expect(patch.titulos[0].dataVencimento).toBe('01/01/2020');
    expect(patch.titulos[0].valorInicial).toBe('R$ 100,00');
    expect(patch.titulos[1].valorInicial).toBe('R$ 200,00');
    // Plano de pagamento apagado.
    expect(patch.parcelas).toEqual([]);
    expect(patch.quantidadeParcelasInformada).toBe('00');
    expect(patch.taxaJurosParcelamento).toBe('0,00');
    expect(patch.paginaParcelamento).toBe(1);
    // Mantém recebimento de honorários de títulos; descarta o de parcelas.
    expect(patch.honorariosDataRecebimento).toEqual({ 'titulo:0': '01/03/2026' });
  });

  it('patchRodadaAoDesfazerAceitarPagamento: promove o snapshot quando o estado não tem valores', () => {
    const patch = patchRodadaAoDesfazerAceitarPagamento({
      parcelamentoAceito: true,
      titulos: [],
      titulosGravadosAceito: [
        { valorInicial: 'R$ 628,88', dataVencimento: '10/01/2026' },
        { valorInicial: 'R$ 556,78', dataVencimento: '10/02/2026' },
      ],
      parcelas: [{ valorParcela: 'R$ 50,00' }],
    });
    // Débitos não somem: vêm do snapshot promovido para `titulos`.
    expect(patch.titulos).toHaveLength(2);
    expect(patch.titulos[0].valorInicial).toBe('R$ 628,88');
    expect(patch.titulos[1].dataVencimento).toBe('10/02/2026');
    expect(patch.titulosGravadosAceito).toEqual([]);
    expect(patch.parcelas).toEqual([]);
  });

  it('patchRodadaAoDesfazerAceitarPagamento: materializa os débitos exibidos (ex.: vindos de parcelas)', () => {
    // Estado e snapshot vazios; os débitos só existem no que está EXIBIDO na grade.
    const exibidos = [
      { valorInicial: 'R$ 628,88', dataVencimento: '10/01/2026' },
      { valorInicial: 'R$ 556,78', dataVencimento: '10/02/2026' },
    ];
    const patch = patchRodadaAoDesfazerAceitarPagamento(
      { parcelamentoAceito: true, titulos: [], titulosGravadosAceito: [], parcelas: exibidos },
      exibidos,
    );
    expect(patch.titulos).toHaveLength(2);
    expect(patch.titulos[0].valorInicial).toBe('R$ 628,88');
    expect(patch.titulos[1].dataVencimento).toBe('10/02/2026');
    // Plano de pagamento apagado mesmo tendo sido a origem dos débitos.
    expect(patch.parcelas).toEqual([]);
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
