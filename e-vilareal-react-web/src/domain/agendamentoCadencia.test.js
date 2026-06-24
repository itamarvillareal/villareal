import { describe, expect, it } from 'vitest';
import {
  agruparPainelPorProcesso,
  itemPainelComNovidade,
  formatarHoraInput,
  montarBodyAgendamentoRequest,
  normalizarHora,
  ordenarPainelItens,
  parseHorariosFixosCsv,
  resumoCadenciaAgendamento,
  textoBuscaProcessoPainel,
  validarCadenciaCliente,
} from './agendamentoCadencia.js';

describe('agendamentoCadencia', () => {
  it('validarCadenciaCliente exige intervalo > 0', () => {
    expect(validarCadenciaCliente({ tipoCadencia: 'INTERVALO', intervaloMinutos: 0 })).toMatch(
      /maior que zero/i,
    );
    expect(validarCadenciaCliente({ tipoCadencia: 'INTERVALO', intervaloMinutos: 30 })).toBeNull();
  });

  it('parseHorariosFixosCsv normaliza HH:mm', () => {
    expect(parseHorariosFixosCsv('8:00, 14:30')).toEqual(['08:00', '14:30']);
  });

  it('formatarHoraInput insere dois-pontos só com dígitos (mobile)', () => {
    expect(formatarHoraInput('17')).toBe('17');
    expect(formatarHoraInput('1730')).toBe('17:30');
    expect(normalizarHora('1730')).toBe('17:30');
    expect(normalizarHora('17')).toBe('17:00');
  });

  it('validarCadenciaCliente PERIODICO exige periodo e horario', () => {
    expect(validarCadenciaCliente({ tipoCadencia: 'PERIODICO', periodo: '', periodoHorario: '08:00' })).toMatch(
      /período/i,
    );
    expect(validarCadenciaCliente({ tipoCadencia: 'PERIODICO', periodo: 'SEMANAL', periodoHorario: '' })).toMatch(
      /horário/i,
    );
    expect(
      validarCadenciaCliente({ tipoCadencia: 'PERIODICO', periodo: 'MENSAL', periodoHorario: '09:00' }),
    ).toBeNull();
  });

  it('montarBodyAgendamentoRequest monta PERIODICO', () => {
    const body = montarBodyAgendamentoRequest({
      tipoCadencia: 'PERIODICO',
      periodo: 'SEMANAL',
      periodoHorario: '08:00',
      intervaloMinutos: '999',
      horariosFixos: '10:00',
      apenasDiasUteis: false,
      considerarFeriados: false,
      prioridade: '0',
      motivo: '',
      janelaInicio: '',
      janelaFim: '',
      validoAteData: '',
      validoAteHora: '',
    });
    expect(body.tipoCadencia).toBe('PERIODICO');
    expect(body.periodo).toBe('SEMANAL');
    expect(body.periodoHorario).toBe('08:00');
    expect(body.intervaloMinutos).toBeNull();
    expect(body.horariosFixos).toBeNull();
  });

  it('resumoCadenciaAgendamento periodico', () => {
    expect(
      resumoCadenciaAgendamento({
        tipoCadencia: 'PERIODICO',
        periodo: 'MENSAL',
        periodoHorario: '09:00:00',
      }),
    ).toBe('mensal às 09:00');
  });

  it('montarBodyAgendamentoRequest monta HORARIOS_FIXOS', () => {
    const body = montarBodyAgendamentoRequest({
      tipoCadencia: 'HORARIOS_FIXOS',
      horariosFixos: '09:00,18:00',
      apenasDiasUteis: true,
      considerarFeriados: false,
      prioridade: '2',
      motivo: 'teste',
      janelaInicio: '08:00',
      janelaFim: '',
      validoAteData: '',
      validoAteHora: '',
    });
    expect(body.tipoCadencia).toBe('HORARIOS_FIXOS');
    expect(body.horariosFixos).toBe('09:00,18:00');
    expect(body.apenasDiasUteis).toBe(true);
    expect(body.prioridade).toBe(2);
  });

  it('ordenarPainelItens prioriza emAtraso e proximaExecucao', () => {
    const sorted = ordenarPainelItens([
      { agendamentoId: 1, emAtraso: false, proximaExecucao: '2026-06-10T10:00:00' },
      { agendamentoId: 2, emAtraso: true, proximaExecucao: '2026-06-11T10:00:00' },
      { agendamentoId: 3, emAtraso: false, proximaExecucao: '2026-06-05T10:00:00' },
    ]);
    expect(sorted.map((x) => x.agendamentoId)).toEqual([2, 3, 1]);
  });

  it('itemPainelComNovidade detecta última execução com novidade', () => {
    expect(itemPainelComNovidade({ statusUltimaExecucao: 'SUCESSO_COM_NOVIDADE' })).toBe(true);
    expect(itemPainelComNovidade({ statusUltimaExecucao: 'SUCESSO_SEM_NOVIDADE' })).toBe(false);
    expect(itemPainelComNovidade({ statusUltimaExecucao: null })).toBe(false);
  });

  it('agruparPainelPorProcesso une agendamentos do mesmo processo', () => {
    const rows = agruparPainelPorProcesso([
      {
        agendamentoId: 1,
        processoId: 99,
        numeroCnj: '5059346',
        cliente: 'Cliente X',
        cadenciaResumida: 'a cada 90 min',
        proximaExecucao: '2026-06-04T22:36:00',
        ultimaExecucao: '2026-06-04T21:06:00',
        statusUltimaExecucao: 'SUCESSO_COM_NOVIDADE',
        falhasConsecutivas: 0,
        emAtraso: false,
        semNunca: false,
      },
      {
        agendamentoId: 2,
        processoId: 99,
        numeroCnj: '5059346',
        cliente: 'Cliente X',
        cadenciaResumida: '09:00,12:00,17:00',
        proximaExecucao: '2026-06-05T09:00:00',
        ultimaExecucao: '2026-06-04T17:00:00',
        statusUltimaExecucao: 'SUCESSO_SEM_NOVIDADE',
        falhasConsecutivas: 0,
        emAtraso: false,
        semNunca: false,
      },
      {
        agendamentoId: 3,
        processoId: 99,
        numeroCnj: '5059346',
        cliente: 'Cliente X',
        cadenciaResumida: 'mensal às 09:00',
        proximaExecucao: '2026-07-01T09:00:00',
        ultimaExecucao: null,
        statusUltimaExecucao: null,
        falhasConsecutivas: 0,
        emAtraso: false,
        semNunca: true,
      },
      {
        agendamentoId: 4,
        processoId: 100,
        numeroCnj: '111',
        cliente: 'Outro',
        cadenciaResumida: 'a cada 60 min',
        proximaExecucao: '2026-06-10T10:00:00',
        ultimaExecucao: null,
        falhasConsecutivas: 0,
        emAtraso: false,
        semNunca: true,
      },
    ]);

    expect(rows).toHaveLength(2);
    const p99 = rows.find((r) => r.processoId === 99);
    expect(p99?.numeroCnj).toBe('5059346');
    expect(p99?.cadenciaResumida).toBe('a cada 90 min · 09:00,12:00,17:00 · mensal às 09:00');
    expect(p99?.proximaExecucao).toBe('2026-06-04T22:36:00');
    expect(p99?.ultimaExecucao).toBe('2026-06-04T21:06:00');
    expect(p99?.statusUltimaExecucao).toBe('SUCESSO_COM_NOVIDADE');
    expect(p99?.semNunca).toBe(false);
    expect(p99?.agendamentos).toHaveLength(3);
  });

  it('agruparPainelPorProcesso compacta muitas cadências', () => {
    const rows = agruparPainelPorProcesso([
      { processoId: 1, cadenciaResumida: 'a', proximaExecucao: '2026-06-01T10:00:00' },
      { processoId: 1, cadenciaResumida: 'b', proximaExecucao: '2026-06-02T10:00:00' },
      { processoId: 1, cadenciaResumida: 'c', proximaExecucao: '2026-06-03T10:00:00' },
      { processoId: 1, cadenciaResumida: 'd', proximaExecucao: '2026-06-04T10:00:00' },
    ]);
    expect(rows[0].cadenciaResumida).toBe('4 cadências');
  });

  it('textoBuscaProcessoPainel inclui cadências dos agendamentos', () => {
    const row = agruparPainelPorProcesso([
      { processoId: 1, numeroCnj: '5059346', cliente: 'X', cadenciaResumida: 'a cada 90 min' },
      { processoId: 1, cadenciaResumida: 'mensal às 09:00', tipoCadencia: 'PERIODICO' },
    ])[0];
    expect(textoBuscaProcessoPainel(row)).toContain('mensal');
    expect(textoBuscaProcessoPainel(row)).toContain('5059346');
  });

  it('ordenarPainelItens prioriza falhas antes de emAtraso', () => {
    const sorted = ordenarPainelItens([
      { agendamentoId: 1, emAtraso: true, proximaExecucao: '2026-06-01T10:00:00' },
      {
        agendamentoId: 2,
        falhasConsecutivas: 2,
        emAtraso: false,
        proximaExecucao: '2026-06-20T10:00:00',
      },
      { agendamentoId: 3, emAtraso: false, proximaExecucao: '2026-06-05T10:00:00' },
    ]);
    expect(sorted.map((x) => x.agendamentoId)).toEqual([2, 1, 3]);
  });
});
