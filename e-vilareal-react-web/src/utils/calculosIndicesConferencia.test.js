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

  it('monta fator fixo para IGPM', () => {
    const inicio = new Date(2024, 5, 1);
    const fim = new Date(2024, 6, 1);
    const tabela = montarLinhasIndicesConferencia('IGPM', null, null, { inicio, fim, fimIpca: fim });
    expect(tabela.tipo).toBe('fixo');
    expect(tabela.linhas.length).toBeGreaterThan(0);
    expect(tabela.linhas[0].valor).toBeCloseTo(6.3, 1);
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
