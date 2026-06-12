import { describe, it, expect } from 'vitest';
import { detectarPjeTribunalPorCnj, tribunalPjeAutomacaoDisponivel } from './pjeTribunalCnj.js';

describe('detectarPjeTribunalPorCnj', () => {
  it('mapeia TRT18', () => {
    const r = detectarPjeTribunalPorCnj('0000105-21.2025.5.18.0051');
    expect(r.codigo).toBe('PJE_TRT18');
    expect(r.mapeado).toBe(true);
    expect(tribunalPjeAutomacaoDisponivel(r.codigo)).toBe(true);
  });

  it('mapeia TRF1', () => {
    expect(detectarPjeTribunalPorCnj('0001234-56.2024.4.01.0001').codigo).toBe('PJE_TRF1');
  });

  it('tribunal não mapeado', () => {
    const r = detectarPjeTribunalPorCnj('0000000-00.2000.8.99.0000');
    expect(r.codigo).toBeNull();
    expect(r.mapeado).toBe(false);
    expect(r.rotulo).toContain('não mapeado');
  });
});
