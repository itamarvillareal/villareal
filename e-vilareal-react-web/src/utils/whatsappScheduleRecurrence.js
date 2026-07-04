/** Tipos e helpers de recorrência para agendamento WhatsApp em lote. */

export const RECORRENCIA_MENSAL = 'MENSAL';
export const RECORRENCIA_SEMANAL = 'SEMANAL';
export const RECORRENCIA_INTERVALO_DIA = 'INTERVALO_DIA';

export const BATCH_MODE_AVULSAS = 'avulsas';
export const BATCH_MODE_MENSAL = 'mensal';
export const BATCH_MODE_SEMANAL = 'semanal';
export const BATCH_MODE_INTERVALO_DIA = 'intervalo_dia';

export const MENSAL_MODO_QUANTIDADE = 'quantidade';
export const MENSAL_MODO_INTERVALO = 'intervalo';

export const DIAS_SEMANA_OPCOES = [
  { valor: 'SEGUNDA', rotulo: 'Seg' },
  { valor: 'TERCA', rotulo: 'Ter' },
  { valor: 'QUARTA', rotulo: 'Qua' },
  { valor: 'QUINTA', rotulo: 'Qui' },
  { valor: 'SEXTA', rotulo: 'Sex' },
  { valor: 'SABADO', rotulo: 'Sáb' },
  { valor: 'DOMINGO', rotulo: 'Dom' },
];

export const INTERVALO_MINUTOS_OPCOES = [
  { valor: 5, rotulo: '5 minutos' },
  { valor: 10, rotulo: '10 minutos' },
  { valor: 15, rotulo: '15 minutos' },
  { valor: 30, rotulo: '30 minutos' },
  { valor: 60, rotulo: '1 hora' },
];

export const MAX_OCORRENCIAS_LOTE = 200;

/**
 * @param {string} batchMode
 * @param {object} state
 * @returns {object|null}
 */
export function buildRecorrenciaPayload(batchMode, state) {
  if (!state) return null;

  if (batchMode === BATCH_MODE_MENSAL) {
    const [hh, mm] = String(state.horaLocal || '').split(':').map((v) => Number(v));
    const dia = Number(state.diaDoMes);
    if (!Number.isFinite(dia) || !Number.isFinite(hh) || !Number.isFinite(mm) || !state.mesInicio) {
      return null;
    }
    const base = {
      tipo: RECORRENCIA_MENSAL,
      diaDoMes: dia,
      hora: hh,
      minuto: mm,
      mesInicio: state.mesInicio,
    };
    if (state.mensalModo === MENSAL_MODO_INTERVALO) {
      if (!state.mesFim) return null;
      return { ...base, mesFim: state.mesFim };
    }
    const qtd = Number(state.quantidadeMeses);
    if (!Number.isFinite(qtd) || qtd < 1) return null;
    return { ...base, quantidadeMeses: qtd };
  }

  if (batchMode === BATCH_MODE_SEMANAL) {
    const dias = Array.isArray(state.diasSemana) ? state.diasSemana.filter(Boolean) : [];
    const [hh, mm] = String(state.horaLocal || '').split(':').map((v) => Number(v));
    const semanas = Number(state.quantidadeSemanas);
    if (!state.dataInicio || dias.length === 0 || !Number.isFinite(hh) || !Number.isFinite(mm) || !Number.isFinite(semanas)) {
      return null;
    }
    return {
      tipo: RECORRENCIA_SEMANAL,
      diasSemana: dias,
      dataInicio: state.dataInicio,
      quantidadeSemanas: semanas,
      hora: hh,
      minuto: mm,
    };
  }

  if (batchMode === BATCH_MODE_INTERVALO_DIA) {
    const [hi, mi] = String(state.horaInicio || '').split(':').map((v) => Number(v));
    const [hf, mf] = String(state.horaFim || '').split(':').map((v) => Number(v));
    const intervalo = Number(state.intervaloMinutos);
    if (!state.data || !Number.isFinite(hi) || !Number.isFinite(mi) || !Number.isFinite(hf) || !Number.isFinite(mf) || !Number.isFinite(intervalo)) {
      return null;
    }
    return {
      tipo: RECORRENCIA_INTERVALO_DIA,
      data: state.data,
      horaInicio: hi,
      minutoInicio: mi,
      horaFim: hf,
      minutoFim: mf,
      intervaloMinutos: intervalo,
    };
  }

  return null;
}
