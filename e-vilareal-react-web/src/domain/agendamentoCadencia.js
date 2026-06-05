import { normalizarDataBr } from '../data/processosHistoricoData.js';

const HORA_RE = /^(\d{1,2}):(\d{2})$/;

/** Períodos da cadência PERIODICO (valor API → rótulo PT). */
export const PERIODOS_CADENCIA = [
  { valor: 'DIARIO', rotulo: 'Diário' },
  { valor: 'SEMANAL', rotulo: 'Semanal' },
  { valor: 'QUINZENAL', rotulo: 'Quinzenal' },
  { valor: 'MENSAL', rotulo: 'Mensal' },
  { valor: 'BIMESTRAL', rotulo: 'Bimestral' },
  { valor: 'SEMESTRAL', rotulo: 'Semestral' },
  { valor: 'ANUAL', rotulo: 'Anual' },
];

const PERIODOS_VALIDOS = new Set(PERIODOS_CADENCIA.map((p) => p.valor));

/** @typedef {{ agendamentoId: number, processoId: number, numeroCnj?: string, cliente?: string, tipoCadencia?: string, cadenciaResumida?: string, proximaExecucao?: string, ultimaExecucao?: string, statusUltimaExecucao?: string, falhasConsecutivas?: number, ultimoErro?: string|null, ultimaFalhaEm?: string|null, emAtraso?: boolean, semNunca?: boolean }} PainelItem */

/**
 * @param {string} valor
 * @returns {string}
 */
export function formatarHoraInput(valor) {
  const digits = String(valor ?? '').replace(/\D/g, '').slice(0, 4);
  if (!digits) return '';
  if (digits.length === 1) return digits;
  if (digits.length === 2) return digits;
  if (digits.length === 3) return `${digits.slice(0, 2)}:${digits.slice(2, 3)}`;
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
}

/**
 * @param {string} valor
 * @returns {string}
 */
export function normalizarHora(valor) {
  const t = String(valor ?? '').trim();
  const parsed = HORA_RE.exec(t);
  if (parsed) {
    const hh = Math.min(23, Number(parsed[1]));
    const mm = Math.min(59, Number(parsed[2]));
    if (Number.isFinite(hh) && Number.isFinite(mm)) {
      return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    }
  }
  const digits = t.replace(/\D/g, '');
  if (!digits) return '';
  let hhDigits = '';
  let mmDigits = '';
  if (digits.length <= 2) {
    hhDigits = digits.padStart(2, '0').slice(0, 2);
    mmDigits = '00';
  } else if (digits.length === 3) {
    hhDigits = digits.slice(0, 2);
    mmDigits = `${digits.slice(2, 3)}0`;
  } else {
    hhDigits = digits.slice(0, 2);
    mmDigits = digits.slice(2, 4);
  }
  const hh = Math.min(23, Number(hhDigits));
  const mm = Math.min(59, Number(mmDigits));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return '';
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/**
 * @param {string} valor
 * @returns {string}
 */
export function formatarDataInput(valor) {
  const digits = String(valor ?? '').replace(/\D/g, '').slice(0, 8);
  if (!digits) return '';
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  if (digits.length <= 2) return dd;
  if (digits.length <= 4) return `${dd}/${mm}`;
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * @param {string} csv
 * @returns {string[]}
 */
export function parseHorariosFixosCsv(csv) {
  const horarios = [];
  for (const parte of String(csv ?? '').split(',')) {
    const t = parte.trim();
    if (!t) continue;
    const norm = normalizarHora(t);
    if (!norm || !HORA_RE.test(norm)) {
      throw new Error(`Horário inválido (use HH:mm): ${t}`);
    }
    horarios.push(norm);
  }
  if (horarios.length === 0) {
    throw new Error('Informe ao menos um horário fixo (HH:mm).');
  }
  return horarios;
}

/**
 * @param {{ tipoCadencia: string, intervaloMinutos?: string|number, horariosFixos?: string, periodo?: string, periodoHorario?: string }} form
 * @returns {string|null}
 */
export function validarCadenciaCliente(form) {
  const tipo = String(form?.tipoCadencia ?? '').trim();
  if (tipo !== 'INTERVALO' && tipo !== 'HORARIOS_FIXOS' && tipo !== 'PERIODICO') {
    return 'Selecione o tipo de cadência.';
  }
  if (tipo === 'INTERVALO') {
    const n = Number(form?.intervaloMinutos);
    if (!Number.isFinite(n) || n <= 0) {
      return 'INTERVALO exige intervalo em minutos maior que zero.';
    }
    return null;
  }
  if (tipo === 'PERIODICO') {
    const periodo = String(form?.periodo ?? '').trim();
    if (!PERIODOS_VALIDOS.has(periodo)) {
      return 'PERIODICO exige um período válido.';
    }
    const hora = horaBrParaApi(String(form?.periodoHorario ?? ''));
    if (!hora) {
      return 'PERIODICO exige horário válido (HH:mm).';
    }
    return null;
  }
  try {
    parseHorariosFixosCsv(form?.horariosFixos ?? '');
    return null;
  } catch (e) {
    return e?.message || 'HORARIOS_FIXOS exige horários válidos.';
  }
}

/**
 * @param {string} horaBr
 * @returns {string|null}
 */
export function horaBrParaApi(horaBr) {
  const norm = normalizarHora(horaBr);
  if (!norm || !HORA_RE.test(norm)) return null;
  return norm;
}

/**
 * @param {string} dataBr
 * @param {string} [horaBr]
 * @returns {string|null}
 */
export function dataHoraBrParaApi(dataBr, horaBr) {
  const data = normalizarDataBr(String(dataBr ?? '').trim());
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(data);
  if (!m) return null;
  const hora = horaBr ? horaBrParaApi(horaBr) : '00:00';
  if (!hora) return null;
  return `${m[3]}-${m[2]}-${m[1]}T${hora}:00`;
}

/**
 * @param {string|undefined|null} iso
 * @returns {{ data: string, hora: string }}
 */
export function apiDateTimeParaBr(iso) {
  const s = String(iso ?? '').trim();
  if (!s) return { data: '', hora: '' };
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s);
  if (!m) return { data: '', hora: '' };
  return {
    data: `${m[3]}/${m[2]}/${m[1]}`,
    hora: `${m[4]}:${m[5]}`,
  };
}

/**
 * @param {string|undefined|null} timeApi — "HH:mm:ss" ou "HH:mm"
 * @returns {string}
 */
export function apiTimeParaBr(timeApi) {
  const s = String(timeApi ?? '').trim();
  const m = /^(\d{2}):(\d{2})/.exec(s);
  if (!m) return '';
  return `${m[1]}:${m[2]}`;
}

/**
 * Monta corpo PUT/POST espelhando {@code AgendamentoRequest}.
 * @param {Record<string, unknown>} form
 */
export function montarBodyAgendamentoRequest(form) {
  const tipoCadencia = String(form.tipoCadencia ?? 'INTERVALO');
  const body = {
    tipoCadencia,
    apenasDiasUteis: Boolean(form.apenasDiasUteis),
    considerarFeriados: Boolean(form.considerarFeriados),
    prioridade: Number(form.prioridade) || 0,
    motivo: String(form.motivo ?? '').trim() || null,
  };

  if (tipoCadencia === 'INTERVALO') {
    body.intervaloMinutos = Math.floor(Number(form.intervaloMinutos));
    body.horariosFixos = null;
    body.periodo = null;
    body.periodoHorario = null;
  } else if (tipoCadencia === 'PERIODICO') {
    body.intervaloMinutos = null;
    body.horariosFixos = null;
    body.periodo = String(form.periodo ?? '').trim();
    body.periodoHorario = horaBrParaApi(String(form.periodoHorario ?? ''));
  } else {
    body.intervaloMinutos = null;
    body.horariosFixos = parseHorariosFixosCsv(form.horariosFixos).join(',');
    body.periodo = null;
    body.periodoHorario = null;
  }

  const ji = horaBrParaApi(String(form.janelaInicio ?? ''));
  const jf = horaBrParaApi(String(form.janelaFim ?? ''));
  body.janelaInicio = ji;
  body.janelaFim = jf;

  const dataVal = String(form.validoAteData ?? '').trim();
  const horaVal = String(form.validoAteHora ?? '').trim();
  if (dataVal) {
    body.validoAte = dataHoraBrParaApi(dataVal, horaVal || '00:00');
  } else {
    body.validoAte = null;
  }

  return body;
}

/**
 * @param {PainelItem[]} itens
 * @returns {PainelItem[]}
 */
/** @param {PainelItem|undefined|null} item */
export function itemPainelEmFalha(item) {
  return Number(item?.falhasConsecutivas) > 0;
}

/**
 * @param {PainelItem|undefined|null} item
 * @returns {string}
 */
export function labelFalhaPainel(item) {
  const n = Number(item?.falhasConsecutivas) || 0;
  if (n <= 0) return '';
  return `Falhando (${n})`;
}

const MAX_CADENCIAS_RESUMO_PAINEL = 3;

/** @param {string|undefined|null} iso */
function parseIsoPainel(iso) {
  const s = String(iso ?? '').trim();
  if (!s) return null;
  const t = new Date(s).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * Agrega linhas do painel (uma por agendamento) em uma linha por processo.
 * @param {PainelItem[]} itens
 */
export function agruparPainelPorProcesso(itens) {
  const map = new Map();
  for (const item of Array.isArray(itens) ? itens : []) {
    const pid = Number(item?.processoId);
    if (!Number.isFinite(pid) || pid < 1) continue;
    let grupo = map.get(pid);
    if (!grupo) {
      grupo = {
        processoId: pid,
        numeroCnj: item.numeroCnj,
        cliente: item.cliente,
        agendamentos: [],
      };
      map.set(pid, grupo);
    }
    grupo.agendamentos.push(item);
    if (!grupo.numeroCnj && item.numeroCnj) grupo.numeroCnj = item.numeroCnj;
    if (!grupo.cliente && item.cliente) grupo.cliente = item.cliente;
  }
  return [...map.values()].map(agregarLinhaProcessoPainel);
}

/** @param {{ processoId: number, numeroCnj?: string, cliente?: string, agendamentos: PainelItem[] }} grupo */
function agregarLinhaProcessoPainel(grupo) {
  const { agendamentos, processoId, numeroCnj, cliente } = grupo;

  const cadenciasUnicas = [
    ...new Set(
      agendamentos
        .map((a) => String(a.cadenciaResumida || a.tipoCadencia || '').trim())
        .filter(Boolean),
    ),
  ];
  const cadenciaResumida =
    cadenciasUnicas.length > MAX_CADENCIAS_RESUMO_PAINEL
      ? `${cadenciasUnicas.length} cadências`
      : cadenciasUnicas.join(' · ') || '—';

  let proximaExecucao = null;
  let proximaMin = null;
  for (const a of agendamentos) {
    const t = parseIsoPainel(a.proximaExecucao);
    if (t != null && (proximaMin == null || t < proximaMin)) {
      proximaMin = t;
      proximaExecucao = a.proximaExecucao;
    }
  }

  let ultimaExecucao = null;
  let ultimaMax = null;
  let statusUltimaExecucao = null;
  for (const a of agendamentos) {
    const t = parseIsoPainel(a.ultimaExecucao);
    if (t != null && (ultimaMax == null || t > ultimaMax)) {
      ultimaMax = t;
      ultimaExecucao = a.ultimaExecucao;
      statusUltimaExecucao = a.statusUltimaExecucao;
    }
  }

  const falhasConsecutivas = Math.max(0, ...agendamentos.map((a) => Number(a.falhasConsecutivas) || 0));
  const emAtraso = agendamentos.some((a) => Boolean(a.emAtraso));
  const semNunca = agendamentos.every((a) => Boolean(a.semNunca));

  const emFalha = agendamentos.filter(itemPainelEmFalha);
  const piorFalha = emFalha.reduce(
    (best, a) =>
      !best || (Number(a.falhasConsecutivas) || 0) > (Number(best.falhasConsecutivas) || 0) ? a : best,
    null,
  );

  return {
    processoId,
    numeroCnj,
    cliente,
    cadenciaResumida,
    proximaExecucao,
    ultimaExecucao,
    statusUltimaExecucao,
    falhasConsecutivas,
    ultimoErro: piorFalha?.ultimoErro ?? null,
    ultimaFalhaEm: piorFalha?.ultimaFalhaEm ?? null,
    emAtraso,
    semNunca,
    agendamentos,
    agendamentoId: agendamentos[0]?.agendamentoId,
  };
}

/** @param {ReturnType<typeof agruparPainelPorProcesso>[number]} processoRow */
export function textoBuscaProcessoPainel(processoRow) {
  const base = [processoRow?.numeroCnj, processoRow?.cliente, processoRow?.cadenciaResumida]
    .filter(Boolean)
    .join(' ');
  const ags = (processoRow?.agendamentos ?? [])
    .map((a) => [a.numeroCnj, a.cliente, a.cadenciaResumida, a.tipoCadencia].filter(Boolean).join(' '))
    .join(' ');
  return `${base} ${ags}`.toLowerCase();
}

export function ordenarPainelItens(itens) {
  const list = Array.isArray(itens) ? [...itens] : [];
  list.sort((a, b) => {
    const aFalha = itemPainelEmFalha(a);
    const bFalha = itemPainelEmFalha(b);
    if (aFalha !== bFalha) return aFalha ? -1 : 1;
    const aAtraso = Boolean(a?.emAtraso);
    const bAtraso = Boolean(b?.emAtraso);
    if (aAtraso !== bAtraso) return aAtraso ? -1 : 1;
    const ta = a?.proximaExecucao ? new Date(a.proximaExecucao).getTime() : Number.MAX_SAFE_INTEGER;
    const tb = b?.proximaExecucao ? new Date(b.proximaExecucao).getTime() : Number.MAX_SAFE_INTEGER;
    if (ta !== tb) return ta - tb;
    return (Number(a?.agendamentoId) || 0) - (Number(b?.agendamentoId) || 0);
  });
  return list;
}

/** @param {string|undefined|null} iso */
export function formatarDateTimePainel(iso) {
  const s = String(iso ?? '').trim();
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const STATUS_LABEL = {
  SUCESSO_COM_NOVIDADE: 'Com novidade',
  SUCESSO_SEM_NOVIDADE: 'Sem novidade',
  ERRO: 'Erro',
  PULADA_OCUPADO: 'Pulada (ocupado)',
};

const ROTULO_PERIODO = Object.fromEntries(PERIODOS_CADENCIA.map((p) => [p.valor, p.rotulo]));

/** @param {{ tipoCadencia?: string, intervaloMinutos?: number|null, horariosFixos?: string|null, periodo?: string, periodoHorario?: string }} ag */
export function resumoCadenciaAgendamento(ag) {
  if (ag?.tipoCadencia === 'PERIODICO') {
    const rotulo = ROTULO_PERIODO[String(ag?.periodo ?? '')] ?? 'periódico';
    const hora = apiTimeParaBr(ag?.periodoHorario) || '?';
    return `${rotulo.toLowerCase()} às ${hora}`;
  }
  if (ag?.tipoCadencia === 'HORARIOS_FIXOS') {
    return String(ag.horariosFixos ?? '').trim() || 'Horários fixos';
  }
  const min = Number(ag?.intervaloMinutos);
  if (Number.isFinite(min) && min > 0) return `a cada ${min} min`;
  return 'Intervalo';
}

/** @param {string|undefined|null} status */
export function labelStatusUltimaExecucao(status) {
  const k = String(status ?? '').trim();
  return STATUS_LABEL[k] || (k ? k : '');
}
