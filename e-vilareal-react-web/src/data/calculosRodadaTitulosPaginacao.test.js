import { describe, expect, it } from 'vitest';
import {
  calcularResumoTitulosGrade,
  calcularTotalLinhaTitulo,
  garantirArrayTitulosTamanho,
  mesclarTitulosPaginaNoArray,
  contarTitulosComValorInicial,
  montarTitulosDimensaoParaResumo,
  resumoTitulosFromApi,
  resolverResumoGeralTitulos,
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

  it('calcularTotalLinhaTitulo soma componentes da linha', () => {
    const row = calcularTotalLinhaTitulo({
      valorInicial: 'R$ 359,00',
      atualizacaoMonetaria: 'R$ 13,47',
      juros: 'R$ 33,56',
      multa: 'R$ 6,04',
      honorarios: 'R$ 0,00',
      total: 'R$ 443,79',
    });
    expect(row.total).toBe('R$ 412,07');
  });

  it('calcularResumoTitulosGrade soma componentes (Somar_Taxas) e ignora linhas vazias', () => {
    const r = calcularResumoTitulosGrade([
      {
        valorInicial: 'R$ 12.230,00',
        atualizacaoMonetaria: 'R$ 4.004,12',
        diasAtraso: '1697',
        juros: 'R$ 9.091,10',
        multa: 'R$ 0,00',
        honorarios: 'R$ 6.149,02',
        total: 'R$ 31.474,24',
      },
      { valorInicial: 'R$ -1.000,00', juros: 'R$ -739,96', honorarios: 'R$ -400,00', diasAtraso: '1527' },
      { valorInicial: '', juros: 'R$ 99,00' },
    ]);
    expect(r.qtd).toContain('02');
    expect(r.valorInicial).toBe('R$ 11.230,00');
    expect(r.juros).toBe('R$ 8.351,14');
    expect(r.total).toBe('R$ 29.334,28');
  });

  it('resumo página vs dimensão: página é subconjunto', () => {
    const dimensao = [
      { valorInicial: 'R$ 100,00', juros: 'R$ 10,00' },
      { valorInicial: 'R$ 200,00', juros: 'R$ 20,00' },
    ];
    const pagina = dimensao.slice(0, 1);
    expect(calcularResumoTitulosGrade(pagina).valorInicial).toBe('R$ 100,00');
    expect(calcularResumoTitulosGrade(dimensao).valorInicial).toBe('R$ 300,00');
  });

  it('montarTitulosDimensaoParaResumo mescla páginas em cache', () => {
    const cache = new Map([
      ['cli:1:1:page:2', { titulos: [{ valorInicial: 'R$ 50,00' }] }],
    ]);
    const merged = montarTitulosDimensaoParaResumo([], 25, cache.entries(), 'cli:1:1');
    expect(merged[20].valorInicial).toBe('R$ 50,00');
  });

  it('montarTitulosDimensaoParaResumo inclui linhas novas além do total da API', () => {
    const titulosLocal = [
      { valorInicial: 'R$ 100,00', juros: 'R$ 10,00' },
      { valorInicial: 'R$ 200,00', juros: 'R$ 20,00' },
      { valorInicial: 'R$ 300,00', juros: 'R$ 30,00' },
      { valorInicial: 'R$ 400,00', juros: 'R$ 40,00' },
      { valorInicial: 'R$ 500,00', juros: 'R$ 50,00' },
      { valorInicial: 'R$ 600,00', juros: 'R$ 60,00' },
    ];
    const merged = montarTitulosDimensaoParaResumo(titulosLocal, 3, null, 'cli:1:1');
    const resumo = calcularResumoTitulosGrade(merged);
    expect(resumo.qtd).toContain('06');
    expect(resumo.valorInicial).toBe('R$ 2.100,00');
  });

  it('contarTitulosComValorInicial ignora linhas vazias', () => {
    expect(contarTitulosComValorInicial([{ valorInicial: 'R$ 1,00' }, { valorInicial: '' }])).toBe(1);
  });

  it('resolverResumoGeralTitulos usa titulosResumo da API enquanto a dimensão está incompleta', () => {
    const pagina = [{ valorInicial: 'R$ 100,00', juros: 'R$ 10,00' }];
    const resumo = resolverResumoGeralTitulos(pagina, 64, {
      quantidadeTitulos: 64,
      totalValorInicial: 6400,
      totalJuros: 640,
      totalMulta: 0,
      totalAtualizacao: 320,
      totalHonorarios: 0,
      totalGeral: 7360,
      totalDiasAtraso: 1000,
    });
    expect(resumo.qtd).toContain('64');
    expect(resumo.total).toContain('7.360,00');
  });

  it('resolverResumoGeralTitulos prefere soma local quando todos os títulos estão carregados', () => {
    const dimensao = [
      { valorInicial: 'R$ 100,00', juros: 'R$ 10,00' },
      { valorInicial: 'R$ 200,00', juros: 'R$ 20,00' },
    ];
    const resumo = resolverResumoGeralTitulos(dimensao, 2, {
      quantidadeTitulos: 99,
      totalValorInicial: 9999,
      totalGeral: 9999,
    });
    expect(resumo.valorInicial).toBe('R$ 300,00');
    expect(resumo.qtd).toContain('02');
  });

  it('resolverResumoGeralTitulos usa local quando quantidadeTitulos da API já está toda carregada (slots vazios)', () => {
    const dimensao = Array.from({ length: 60 }, (_, i) =>
      i < 8
        ? {
            valorInicial: 'R$ 100,00',
            juros: 'R$ 10,00',
            multa: 'R$ 2,00',
            honorarios: 'R$ 20,00',
          }
        : { valorInicial: '' },
    );
    const resumo = resolverResumoGeralTitulos(dimensao, 60, {
      quantidadeTitulos: 8,
      totalValorInicial: 800,
      totalMulta: 0,
      totalHonorarios: 0,
      totalGeral: 4000,
    });
    expect(resumo.qtd).toContain('08');
    expect(resumo.multa).toBe('R$ 16,00');
    expect(resumo.honorarios).toBe('R$ 160,00');
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

  it('ajuste de R$ 0,01 em honorários altera o total geral exatamente R$ 0,01', () => {
    const titulosAntes = [
      {
        valorInicial: 'R$ 625,49',
        atualizacaoMonetaria: 'R$ 21,50',
        juros: 'R$ 6,39',
        multa: 'R$ 6,53',
        honorarios: 'R$ 131,98',
      },
      {
        valorInicial: 'R$ 560,07',
        atualizacaoMonetaria: 'R$ 19,25',
        juros: 'R$ 3,81',
        multa: 'R$ 5,83',
        honorarios: 'R$ 117,79',
      },
      {
        valorInicial: 'R$ 566,32',
        atualizacaoMonetaria: 'R$ 19,46',
        juros: 'R$ 3,85',
        multa: 'R$ 5,89',
        honorarios: 'R$ 119,10',
      },
      {
        valorInicial: 'R$ 558,27',
        atualizacaoMonetaria: 'R$ 13,98',
        juros: 'R$ 2,82',
        multa: 'R$ 5,74',
        honorarios: 'R$ 116,16',
      },
    ];
    const titulosDepois = titulosAntes.map((t, i) =>
      i === 3 ? { ...t, honorarios: 'R$ 116,17' } : t
    );
    const antes = calcularResumoTitulosGrade(titulosAntes);
    const depois = calcularResumoTitulosGrade(titulosDepois);
    expect(depois.honorarios).toBe('R$ 485,04');
    expect(antes.honorarios).toBe('R$ 485,03');
    expect(depois.juros).toBe('R$ 16,87');
    expect(parseFloat(depois.total.replace(/[^\d,]/g, '').replace(',', '.'))).toBeCloseTo(
      parseFloat(antes.total.replace(/[^\d,]/g, '').replace(',', '.')) + 0.01,
      2
    );
  });
});
