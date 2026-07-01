import { describe, expect, it } from 'vitest';
import {
  descricaoRegraInicio,
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
    expect(normalizarRegraInicioCobrancaDias(61)).toBe(61);
    expect(normalizarRegraInicioCobrancaDias(60)).toBe(61);
    expect(normalizarRegraInicioCobrancaDias(30)).toBe(61);
    expect(normalizarRegraInicioCobrancaDias(99)).toBe(1);
  });

  it('importar tudo — nenhum descartado no exemplo', () => {
    const unidades = [unidadeComDias(75, 40, 10), unidadeComDias(30), unidadeComDias(90, 65)];
    const res = resumoPreviasRegraInicio(unidades, 1, DATA);
    expect(res.descartados).toBe(0);
    expect(labelRegraInicio(1)).toBe('Importar tudo');
  });

  it('60+1 condicional — prévia exige >60 dias na planilha', () => {
    const com61 = unidadeComDias(4, 10, 61);
    const so4 = unidadeComDias(4);
    const so30 = unidadeComDias(30);

    expect(unidadeAcionadaPelaRegra(com61, 61, DATA)).toBe(true);
    expect(unidadeAcionadaPelaRegra(so4, 61, DATA)).toBe(false);
    expect(unidadeAcionadaPelaRegra(so30, 61, DATA)).toBe(false);

    const res = resumoPreviasRegraInicio([com61, so4, so30], 61, DATA);
    expect(res.acionados).toBe(1);
    expect(res.descartados).toBe(2);
    expect(res.regraLabel).toBe('60+1 condicional');
  });

  it('descricaoRegraInicio', () => {
    expect(descricaoRegraInicio(1)).toMatch(/1 dia ou mais/);
    const cond = descricaoRegraInicio(61);
    expect(Array.isArray(cond)).toBe(true);
    expect(cond.join(' ')).toMatch(/débito cadastrado/);
    expect(cond.join(' ')).toMatch(/61 dias/);
  });

  it('diasDesdeVencimento futuro retorna null', () => {
    expect(diasDesdeVencimento('10/07/2026', DATA)).toBeNull();
  });
});
