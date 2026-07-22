import { describe, expect, it } from 'vitest';
import {
  resolveHonorariosConfigLinha,
  resolveMultaPctLinha,
} from './calculosEncargosPainel.js';

describe('calculosEncargosPainel', () => {
  it('resolveMultaPctLinha: usa painel quando snapshot traz «0»', () => {
    expect(resolveMultaPctLinha({ multaEspecial: '0' }, 0.3)).toBe(0.3);
    expect(resolveMultaPctLinha({ multaEspecial: '0 %' }, 0.3)).toBe(0.3);
    expect(resolveMultaPctLinha({}, 0.3)).toBe(0.3);
  });

  it('resolveMultaPctLinha: respeita override positivo em Datas Especiais', () => {
    expect(resolveMultaPctLinha({ multaEspecial: '10%' }, 0.3)).toBeCloseTo(0.1);
  });

  it('resolveHonorariosConfigLinha: usa painel quando snapshot traz «0»', () => {
    const r = resolveHonorariosConfigLinha(
      { honorariosValorEspecial: '0 %', honorariosTipoEspecial: '' },
      'fixos',
      0.2,
    );
    expect(r.honorariosTipoUsado).toBe('fixos');
    expect(r.honorPctFixoUsado).toBe(0.2);
  });

  it('resolveHonorariosConfigLinha: respeita override positivo', () => {
    const r = resolveHonorariosConfigLinha({ honorariosValorEspecial: '15%' }, 'fixos', 0.2);
    expect(r.honorPctFixoUsado).toBeCloseTo(0.15);
  });
});
