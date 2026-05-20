import { describe, expect, it } from 'vitest';
import {
  dataNoPeriodo,
  isPeriodoAnoInteiro,
  modoPeriodo,
  periodoParaIntervalo,
  periodoParaQueryApi,
  periodoParaMesRefObrigatorio,
} from './periodoFinanceiro.js';

describe('periodoFinanceiro', () => {
  it('detecta ano inteiro', () => {
    expect(isPeriodoAnoInteiro('2025')).toBe(true);
    expect(isPeriodoAnoInteiro('2025-05')).toBe(false);
  });

  it('periodoParaQueryApi usa intervalo de datas', () => {
    expect(periodoParaQueryApi('2025')).toEqual({
      dataInicio: '2025-01-01',
      dataFim: '2025-12-31',
    });
    expect(periodoParaQueryApi('2025-04')).toEqual({
      dataInicio: '2025-04-01',
      dataFim: '2025-04-30',
    });
  });

  it('dataNoPeriodo', () => {
    expect(dataNoPeriodo('2024-05-15', '2024')).toBe(true);
    expect(dataNoPeriodo('2023-05-15', '2024')).toBe(false);
    expect(periodoParaIntervalo('2024-02').dataFim).toBe('2024-02-29');
  });

  it('periodoParaMesRefObrigatorio — ano vira janeiro', () => {
    expect(periodoParaMesRefObrigatorio('2025')).toBe('2025-01');
    expect(periodoParaMesRefObrigatorio('2025-06')).toBe('2025-06');
  });

  it('modoPeriodo', () => {
    expect(modoPeriodo('2025')).toBe('ano');
    expect(modoPeriodo('2025-03')).toBe('mes');
  });
});
