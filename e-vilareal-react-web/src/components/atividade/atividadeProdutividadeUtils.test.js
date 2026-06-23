import { describe, expect, it } from 'vitest';
import {
  agruparSessoesTrabalho,
  calcularHorasAtivasPorDia,
  preencherPeriodo,
  resumoProdutividade,
} from './atividadeProdutividadeUtils.js';

describe('agruparSessoesTrabalho', () => {
  it('ignora sessões com menos de 1 minuto', () => {
    const sessoes = agruparSessoesTrabalho([
      new Date(2026, 5, 17, 7, 48, 34).getTime(),
      new Date(2026, 5, 17, 7, 48, 38).getTime(),
    ]);
    expect(sessoes).toHaveLength(0);
  });

  it('mantém bloco noturno com pausa interna de 7 min (17/06 — madrugada)', () => {
    const sessoes = agruparSessoesTrabalho([
      new Date(2026, 5, 17, 0, 8, 38).getTime(),
      new Date(2026, 5, 17, 0, 12, 29).getTime(),
      new Date(2026, 5, 17, 0, 19, 52).getTime(),
      new Date(2026, 5, 17, 0, 19, 55).getTime(),
    ]);
    expect(sessoes).toHaveLength(1);
    expect(sessoes[0].duracaoMs).toBe(
      new Date(2026, 5, 17, 0, 19, 55).getTime() - new Date(2026, 5, 17, 0, 8, 38).getTime()
    );
  });
});

describe('calcularHorasAtivasPorDia', () => {
  it('calcula o dia 17/06 conforme jornadas descritas (dados parciais até 08:32)', () => {
    const atividades = [
      { dataBr: '17/06/2026', horaBr: '00:08:38' },
      { dataBr: '17/06/2026', horaBr: '00:12:29' },
      { dataBr: '17/06/2026', horaBr: '00:19:52' },
      { dataBr: '17/06/2026', horaBr: '00:19:55' },
      { dataBr: '17/06/2026', horaBr: '07:48:34' },
      { dataBr: '17/06/2026', horaBr: '07:48:38' },
      { dataBr: '17/06/2026', horaBr: '08:21:13' },
      { dataBr: '17/06/2026', horaBr: '08:21:16' },
      { dataBr: '17/06/2026', horaBr: '08:21:17' },
      { dataBr: '17/06/2026', horaBr: '08:21:48' },
      { dataBr: '17/06/2026', horaBr: '08:22:53' },
      { dataBr: '17/06/2026', horaBr: '08:24:33' },
      { dataBr: '17/06/2026', horaBr: '08:25:02' },
      { dataBr: '17/06/2026', horaBr: '08:25:13' },
      { dataBr: '17/06/2026', horaBr: '08:31:47' },
      { dataBr: '17/06/2026', horaBr: '08:32:13' },
    ];
    const [ponto] = calcularHorasAtivasPorDia(atividades);
    // madrugada ~11,3 min + manhã ~11 min; bloco 07:48 descartado
    expect(ponto.sessoes).toBe(2);
    expect(ponto.horas).toBeCloseTo(0.37, 1);
  });

  it('inclui jornada da manhã até 10:18 como um bloco contínuo', () => {
    const atividades = [
      { dataBr: '17/06/2026', horaBr: '08:21:13' },
      { dataBr: '17/06/2026', horaBr: '08:50:00' },
      { dataBr: '17/06/2026', horaBr: '09:15:00' },
      { dataBr: '17/06/2026', horaBr: '09:44:00' },
      { dataBr: '17/06/2026', horaBr: '09:55:00' },
      { dataBr: '17/06/2026', horaBr: '10:18:00' },
    ];
    const [ponto] = calcularHorasAtivasPorDia(atividades);
    expect(ponto.sessoes).toBe(1);
    expect(ponto.horas).toBeCloseTo(1.95, 2);
  });

  it('separa jornadas com pausa de 30 min ou mais', () => {
    const atividades = [
      { dataBr: '22/06/2026', horaBr: '09:00:00' },
      { dataBr: '22/06/2026', horaBr: '09:20:00' },
      { dataBr: '22/06/2026', horaBr: '10:00:00' },
      { dataBr: '22/06/2026', horaBr: '10:15:00' },
    ];
    const [ponto] = calcularHorasAtivasPorDia(atividades);
    // 20 min + 15 min em duas sessões
    expect(ponto.sessoes).toBe(2);
    expect(ponto.horas).toBeCloseTo(0.58, 2);
  });
});

describe('preencherPeriodo', () => {
  it('inclui dias sem atividade com zero horas', () => {
    const pontos = calcularHorasAtivasPorDia([{ dataBr: '22/06/2026', horaBr: '09:00:00' }]);
    const preenchido = preencherPeriodo(pontos, '2026-06-21', '2026-06-23');
    expect(preenchido).toHaveLength(3);
    expect(preenchido.find((p) => p.dia === '21/06/2026')?.horas).toBe(0);
    expect(preenchido.find((p) => p.dia === '22/06/2026')?.atividades).toBe(1);
  });
});

describe('resumoProdutividade', () => {
  it('calcula total e média apenas em dias com atividade', () => {
    const pontos = [
      { dia: '21/06/2026', horas: 0, atividades: 0 },
      { dia: '22/06/2026', horas: 2, atividades: 5 },
      { dia: '23/06/2026', horas: 4, atividades: 8 },
    ];
    const r = resumoProdutividade(pontos);
    expect(r.totalHoras).toBe(6);
    expect(r.mediaHoras).toBe(3);
    expect(r.diasComAtividade).toBe(2);
  });
});
