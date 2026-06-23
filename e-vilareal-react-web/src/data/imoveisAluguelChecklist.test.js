import { describe, expect, it } from 'vitest';
import {
  contarPendenciasMatriz,
  infoEstadoCompetencia,
  itemMatrizPorCompetencia,
  rotuloCompetenciaCurta,
} from './imoveisAluguelChecklist.js';

describe('imoveisAluguelChecklist', () => {
  it('rotuloCompetenciaCurta formata AAAA-MM', () => {
    expect(rotuloCompetenciaCurta('2026-06')).toBe('jun/2026');
  });

  it('contarPendenciasMatriz ignora vinculados', () => {
    const meses = [
      { competencia: '2026-05', estado: 'VINCULADO' },
      { competencia: '2026-06', estado: 'SEM_CANDIDATO' },
      { competencia: '2026-07', estado: 'CANDIDATO_UNICO' },
    ];
    expect(contarPendenciasMatriz(meses)).toBe(2);
  });

  it('itemMatrizPorCompetencia encontra mês', () => {
    const meses = [{ competencia: '2026-06', estado: 'VINCULADO' }];
    expect(itemMatrizPorCompetencia(meses, '2026-06')?.estado).toBe('VINCULADO');
  });

  it('infoEstadoCompetencia rotula estados', () => {
    expect(infoEstadoCompetencia('VINCULADO').icon).toBe('ok');
    expect(infoEstadoCompetencia('CANDIDATO_UNICO').icon).toBe('warn');
  });
});
