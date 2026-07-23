import { describe, expect, it } from 'vitest';
import {
  calcularIntervaloIndicesRodada,
  montarLinhasIndicesConferencia,
  INPC_ESCALA_VBA,
} from './calculosIndicesConferencia.js';

describe('calculosIndicesConferencia', () => {
  it('monta linhas INPC com escala VBA', () => {
    const inicio = new Date(2024, 0, 1);
    const fim = new Date(2024, 1, 1);
    const tabela = montarLinhasIndicesConferencia(
      'INPC',
      { '2024-01': 0.5, '2024-02': 0.42 },
      null,
      { inicio, fim, fimIpca: fim },
    );
    expect(tabela.linhas).toHaveLength(2);
    expect(tabela.linhas[0].usado).toBeCloseTo(0.5 * INPC_ESCALA_VBA, 6);
    expect(tabela.linhas[0].bcbLabel).toContain('%');
  });

  it('monta série real para IGPM a partir do mapa de outros índices', () => {
    const inicio = new Date(2024, 5, 1);
    const fim = new Date(2024, 6, 1);
    const tabela = montarLinhasIndicesConferencia(
      'IGPM',
      null,
      null,
      { inicio, fim, fimIpca: fim },
      { IGPM: { '2024-06': 0.81, '2024-07': 0.61 } },
    );
    expect(tabela.tipo).toBe('serie');
    expect(tabela.linhas).toHaveLength(2);
    expect(tabela.linhas[0].valor).toBeCloseTo(0.81, 4);
    expect(tabela.linhas[1].valor).toBeCloseTo(0.61, 4);
  });

  it('POUPANÇA normaliza para POUPANCA e usa série real; sem série carregada mostra 0', () => {
    const inicio = new Date(2024, 0, 1);
    const fim = new Date(2024, 0, 1);
    const comSerie = montarLinhasIndicesConferencia(
      'POUPANÇA',
      null,
      null,
      { inicio, fim, fimIpca: fim },
      { POUPANCA: { '2024-01': 0.5879 } },
    );
    expect(comSerie.tipo).toBe('serie');
    expect(comSerie.linhas[0].valor).toBeCloseTo(0.5879, 4);

    const semSerie = montarLinhasIndicesConferencia('SELIC', null, null, { inicio, fim, fimIpca: fim }, null);
    expect(semSerie.tipo).toBe('serie');
    expect(semSerie.linhas[0].valor).toBe(0);
  });

  it('IPCA-E usa série própria (IPCA-15) vinda do mapa de outros índices', () => {
    const inicio = new Date(2024, 0, 1);
    const fim = new Date(2024, 3, 1); // relatório: competências até o mês anterior (jan..mar)
    const tabela = montarLinhasIndicesConferencia(
      'IPCA-E',
      null,
      { '2024-01': 9.99 }, // mapa IPCA não deve ser usado
      { inicio, fim, fimIpca: new Date(2024, 2, 1) },
      { 'IPCA-E': { '2024-01': 0.31, '2024-02': 0.78, '2024-03': 0.36 } },
    );
    expect(tabela.tipo).toBe('serie');
    expect(tabela.linhas).toHaveLength(3);
    expect(tabela.linhas[0].valor).toBeCloseTo(0.31, 4);
    expect(tabela.linhas[2].valor).toBeCloseTo(0.36, 4);
  });

  it('intervalo considera datas especiais dos títulos', () => {
    const { inicio, fim } = calcularIntervaloIndicesRodada({
      titulos: [
        {
          dataVencimento: '01/06/2020',
          datasEspeciais: { dataInicialAtual: '15/01/2016', dataFinalAtual: '20/05/2026' },
        },
      ],
      dataCalculo: '20/05/2026',
      aceitarPagamento: true,
    });
    expect(inicio.getFullYear()).toBe(2016);
    expect(inicio.getMonth()).toBe(0);
    expect(fim.getFullYear()).toBe(2026);
  });
});
