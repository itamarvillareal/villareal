import { describe, expect, it } from 'vitest';
import { buildPontosGraficoConsolidado, ultimosNMeses } from './consolidadoUtils.js';

describe('ultimosNMeses', () => {
  it('retorna N meses', () => {
    expect(ultimosNMeses(6)).toHaveLength(6);
    expect(ultimosNMeses(24)).toHaveLength(24);
  });
});

describe('buildPontosGraficoConsolidado', () => {
  const resumo = {
    meses: [
      { contaCodigo: 'A', ano: 2026, mes: 5, saldoMes: 1000, quantidadeLancamentos: 10 },
      { contaCodigo: 'B', ano: 2026, mes: 5, saldoMes: -200, quantidadeLancamentos: 3 },
    ],
  };

  it('monta série única da conta ativa', () => {
    const { pontos, seriesKeys } = buildPontosGraficoConsolidado({
      resumo,
      codigoAtivo: 'A',
      qtdMeses: 6,
      serie: 'saldo',
      comparar: false,
    });
    expect(seriesKeys).toEqual(['valor']);
    const maio = pontos.find((p) => p.ano === 2026 && p.mes === 5);
    expect(maio?.valor).toBe(1000);
  });

  it('monta comparativo entre contas', () => {
    const { pontos, seriesKeys } = buildPontosGraficoConsolidado({
      resumo,
      codigoAtivo: 'A',
      qtdMeses: 6,
      serie: 'quantidade',
      comparar: true,
    });
    expect(seriesKeys).toContain('A');
    expect(seriesKeys).toContain('B');
    const maio = pontos.find((p) => p.ano === 2026 && p.mes === 5);
    expect(maio?.A).toBe(10);
    expect(maio?.B).toBe(3);
  });
});
