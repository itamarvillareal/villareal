import { describe, expect, it } from 'vitest';
import {
  calcularSaldoBancoNaData,
  calcularSaldoBancoPorMes,
  dataLancamentoParaIso,
  formatarDataBrDeIso,
  labelMesAnoPt,
  parseMesIso,
} from './financeiroSaldoDiario.js';

describe('financeiroSaldoDiario', () => {
  it('dataLancamentoParaIso aceita BR e ISO', () => {
    expect(dataLancamentoParaIso('11/05/2026')).toBe('2026-05-11');
    expect(dataLancamentoParaIso('2026-05-11')).toBe('2026-05-11');
  });

  it('calcularSaldoBancoNaData acumula até a data', () => {
    const lista = [
      { data: '10/05/2026', valor: 100 },
      { data: '11/05/2026', valor: -30 },
    ];
    const r = calcularSaldoBancoNaData(lista, '2026-05-11');
    expect(r.saldo).toBe(70);
  });

  it('calcularSaldoBancoPorMes lista todos os dias com saldo acumulado', () => {
    const lista = [
      { data: '30/04/2026', valor: 1000 },
      { data: '10/05/2026', valor: 50 },
      { data: '11/05/2026', valor: -30 },
    ];
    const r = calcularSaldoBancoPorMes(lista, 2026, 5);
    expect(r.saldoInicial).toBe(1000);
    expect(r.dias).toHaveLength(31);
    expect(r.dias[0].saldo).toBe(1000);
    expect(r.dias[9].saldo).toBe(1050);
    expect(r.dias[10].saldo).toBe(1020);
    expect(r.dias[30].saldo).toBe(1020);
  });

  it('parseMesIso e labelMesAnoPt', () => {
    expect(parseMesIso('2026-05')).toEqual({ ano: 2026, mes: 5 });
    expect(labelMesAnoPt('2026-05')).toBe('Maio de 2026');
  });

  it('formatarDataBrDeIso', () => {
    expect(formatarDataBrDeIso('2026-05-11')).toBe('11/05/2026');
  });
});
