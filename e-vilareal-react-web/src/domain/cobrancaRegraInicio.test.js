import { describe, expect, it } from 'vitest';
import {
  diasDesdeVencimento,
  labelRegraInicio,
  normalizarRegraInicioCobrancaDias,
  resumoPreviasRegraInicio,
  unidadeAcionadaPelaRegra,
} from './cobrancaRegraInicio.js';

const DATA = new Date(2026, 5, 3); // 2026-06-03 local

function vencComDiasAtraso(dias) {
  const v = new Date(DATA);
  v.setDate(v.getDate() - dias);
  const dd = String(v.getDate()).padStart(2, '0');
  const mm = String(v.getMonth() + 1).padStart(2, '0');
  return { vencimento: `${dd}/${mm}/${v.getFullYear()}` };
}

function unidadeComDias(...diasList) {
  return { cobrancas: diasList.map((d) => vencComDiasAtraso(d)) };
}

describe('cobrancaRegraInicio', () => {
  it('normalizarRegraInicioCobrancaDias', () => {
    expect(normalizarRegraInicioCobrancaDias(60)).toBe(60);
    expect(normalizarRegraInicioCobrancaDias(99)).toBe(1);
  });

  it('D+60 exemplo spec', () => {
    const a = unidadeComDias(75, 40, 10);
    const b = unidadeComDias(30);
    const c = unidadeComDias(90, 65);

    expect(unidadeAcionadaPelaRegra(a, 60, DATA)).toBe(true);
    expect(unidadeAcionadaPelaRegra(b, 60, DATA)).toBe(false);
    expect(unidadeAcionadaPelaRegra(c, 60, DATA)).toBe(true);

    const res = resumoPreviasRegraInicio([a, b, c], 60, DATA);
    expect(res.acionados).toBe(2);
    expect(res.descartados).toBe(1);
    expect(res.titulosDescartados).toBe(1);
    expect(labelRegraInicio(60)).toBe('D+60');
  });

  it('D+1 nenhum descartado no exemplo', () => {
    const unidades = [unidadeComDias(75, 40, 10), unidadeComDias(30), unidadeComDias(90, 65)];
    const res = resumoPreviasRegraInicio(unidades, 1, DATA);
    expect(res.descartados).toBe(0);
  });

  it('diasDesdeVencimento futuro retorna null', () => {
    expect(diasDesdeVencimento('10/07/2026', DATA)).toBeNull();
  });
});
