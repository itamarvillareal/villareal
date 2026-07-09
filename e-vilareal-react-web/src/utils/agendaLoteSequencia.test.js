import { describe, expect, it } from 'vitest';
import {
  ajustarFimDeSemanaParaSegunda,
  aplicarDatasNasLinhas,
  criarLinhasAgendamentoLoteVazias,
  diaSemanaExtensoAgendaLote,
  filtrarLinhasAgendaFuturas,
  dataAgendaEhHojeOuFutura,
  gerarDatasSequenciaAgendaLote,
  marcarUltimoAgendamentoNasLinhas,
  montarLinhasSequenciaAgendaLote,
} from './agendaLoteSequencia.js';

describe('ajustarFimDeSemanaParaSegunda', () => {
  it('sábado vira segunda', () => {
    expect(ajustarFimDeSemanaParaSegunda('11/07/2026')).toBe('13/07/2026');
  });

  it('domingo vira segunda', () => {
    expect(ajustarFimDeSemanaParaSegunda('12/07/2026')).toBe('13/07/2026');
  });

  it('dia útil permanece', () => {
    expect(ajustarFimDeSemanaParaSegunda('08/07/2026')).toBe('08/07/2026');
  });
});

describe('gerarDatasSequenciaAgendaLote', () => {
  it('sequência semanal gera 12 datas', () => {
    const datas = gerarDatasSequenciaAgendaLote({ dataBaseBr: '08/07/2026', tipoSequencia: 'semanal' });
    expect(datas).toHaveLength(12);
    expect(datas[0]).toBe('08/07/2026');
    expect(datas[1]).toBe('15/07/2026');
  });

  it('sequência diária pula fim de semana para segunda', () => {
    const datas = gerarDatasSequenciaAgendaLote({ dataBaseBr: '09/07/2026', tipoSequencia: 'diaria' });
    expect(datas[0]).toBe('09/07/2026');
    expect(datas[1]).toBe('10/07/2026');
    expect(datas[2]).toBe('13/07/2026');
  });
});

describe('montarLinhasSequenciaAgendaLote', () => {
  it('marca último agendamento', () => {
    const linhas = montarLinhasSequenciaAgendaLote({
      dataBaseBr: '08/07/2026',
      tipoSequencia: 'semanal',
      textoBase: 'Prazo',
      hora: '10:00',
    });
    expect(linhas[11].informacao).toBe('Prazo — Último agendamento');
  });
});

describe('diaSemanaExtensoAgendaLote', () => {
  it('retorna dia por extenso', () => {
    expect(diaSemanaExtensoAgendaLote('08/07/2026')).toBe('quarta-feira');
  });
});

describe('marcarUltimoAgendamentoNasLinhas', () => {
  it('não marca sufixo na primeira linha quando só ela tem data', () => {
    const linhas = criarLinhasAgendamentoLoteVazias();
    linhas[0] = { dataBr: '08/07/2026', hora: '', informacao: 'A' };
    const out = marcarUltimoAgendamentoNasLinhas(linhas);
    expect(out[0].informacao).toBe('A');
    expect(out[11].informacao).toBe('');
  });

  it('marca sufixo somente na linha 12 quando preenchida', () => {
    const linhas = criarLinhasAgendamentoLoteVazias();
    linhas[0] = { dataBr: '08/07/2026', hora: '', informacao: 'A' };
    linhas[11] = { dataBr: '08/06/2027', hora: '', informacao: 'B' };
    const out = marcarUltimoAgendamentoNasLinhas(linhas);
    expect(out[0].informacao).toBe('A');
    expect(out[11].informacao).toBe('B — Último agendamento');
  });

  it('remove sufixo indevido de linhas anteriores', () => {
    const linhas = criarLinhasAgendamentoLoteVazias();
    linhas[0] = { dataBr: '08/07/2026', hora: '', informacao: 'A — Último agendamento' };
    linhas[11] = { dataBr: '08/06/2027', hora: '', informacao: 'B' };
    const out = marcarUltimoAgendamentoNasLinhas(linhas);
    expect(out[0].informacao).toBe('A');
    expect(out[11].informacao).toBe('B — Último agendamento');
  });

  it('preserva espaços enquanto o usuário digita', () => {
    const linhas = criarLinhasAgendamentoLoteVazias();
    linhas[0] = { dataBr: '08/07/2026', hora: '', informacao: 'fazer ' };
    const out = marcarUltimoAgendamentoNasLinhas(linhas);
    expect(out[0].informacao).toBe('fazer ');
  });
});

describe('dataAgendaEhHojeOuFutura', () => {
  it('considera hoje e datas posteriores como futuras', () => {
    const ref = new Date(2026, 6, 8);
    expect(dataAgendaEhHojeOuFutura('08/07/2026', ref)).toBe(true);
    expect(dataAgendaEhHojeOuFutura('09/07/2026', ref)).toBe(true);
    expect(dataAgendaEhHojeOuFutura('07/07/2026', ref)).toBe(false);
  });
});

describe('aplicarDatasNasLinhas', () => {
  it('replica hora e informação da primeira linha nas demais', () => {
    const linhas = [
      { dataBr: '08/07/2026', hora: '08:00', informacao: 'fazer feira' },
      ...Array.from({ length: 11 }, () => ({ dataBr: '', hora: '', informacao: '' })),
    ];
    const datas = gerarDatasSequenciaAgendaLote({ dataBaseBr: '08/07/2026', tipoSequencia: 'mensal' });
    const out = aplicarDatasNasLinhas(linhas, datas);
    expect(out[0].hora).toBe('08:00');
    expect(out[0].informacao).toBe('fazer feira');
    expect(out[1].hora).toBe('08:00');
    expect(out[1].informacao).toBe('fazer feira');
    expect(out[11].informacao).toBe('fazer feira — Último agendamento');
  });
});
