import { normalizarDataBr } from '../data/processosHistoricoData.js';

export const QTD_LINHAS_AGENDAMENTO_LOTE = 12;

export const TIPOS_SEQUENCIA_AGENDA_LOTE = [
  { id: 'diaria', label: 'Diária' },
  { id: 'semanal', label: 'Semanal' },
  { id: 'mensal', label: 'Mensal' },
  { id: 'anual', label: 'Anual' },
];

const DIAS_SEMANA_EXTENSO = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
];

function parseDataBrCompleta(str) {
  const norm = normalizarDataBr(str);
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(norm ?? '').trim());
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy)) return null;
  if (mm < 1 || mm > 12) return null;
  const maxDia = new Date(yyyy, mm, 0).getDate();
  if (dd < 1 || dd > maxDia) return null;
  return { dd, mm, yyyy };
}

function dataStr(parsed) {
  return `${String(parsed.dd).padStart(2, '0')}/${String(parsed.mm).padStart(2, '0')}/${parsed.yyyy}`;
}

function parsedToDate(parsed) {
  return new Date(parsed.yyyy, parsed.mm - 1, parsed.dd);
}

function dateToParsed(dateObj) {
  return { dd: dateObj.getDate(), mm: dateObj.getMonth() + 1, yyyy: dateObj.getFullYear() };
}

/** Sábado e domingo → próxima segunda-feira. */
export function ajustarFimDeSemanaParaSegunda(dataBr) {
  const parsed = parseDataBrCompleta(dataBr);
  if (!parsed) return String(dataBr ?? '').trim();
  const dt = parsedToDate(parsed);
  const dow = dt.getDay();
  if (dow === 6) dt.setDate(dt.getDate() + 2);
  else if (dow === 0) dt.setDate(dt.getDate() + 1);
  return dataStr(dateToParsed(dt));
}

export function diaSemanaExtensoAgendaLote(dataBr) {
  const parsed = parseDataBrCompleta(dataBr);
  if (!parsed) return '—';
  const dt = parsedToDate(parsed);
  return DIAS_SEMANA_EXTENSO[dt.getDay()] ?? '—';
}

/** Hoje (início do dia local) ou data posterior — usado para cancelar/editar só o futuro do lote. */
export function dataAgendaEhHojeOuFutura(dataBr, ref = new Date()) {
  const parsed = parseDataBrCompleta(dataBr);
  if (!parsed) return false;
  const dt = parsedToDate(parsed);
  const hoje = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  return dt >= hoje;
}

export function filtrarLinhasAgendaFuturas(linhas, ref = new Date()) {
  return (Array.isArray(linhas) ? linhas : []).filter((l) => dataAgendaEhHojeOuFutura(l?.dataBr, ref));
}

function addDias(parsed, dias) {
  const dt = parsedToDate(parsed);
  dt.setDate(dt.getDate() + dias);
  return dateToParsed(dt);
}

function addMeses(parsed, meses) {
  const dt = new Date(parsed.yyyy, parsed.mm - 1, parsed.dd);
  dt.setMonth(dt.getMonth() + meses);
  return dateToParsed(dt);
}

function addAnos(parsed, anos) {
  const dt = new Date(parsed.yyyy, parsed.mm - 1, parsed.dd);
  dt.setFullYear(dt.getFullYear() + anos);
  return dateToParsed(dt);
}

function avancarData(parsed, tipoSequencia, indice) {
  if (indice === 0) return parsed;
  if (tipoSequencia === 'diaria') return addDias(parsed, indice);
  if (tipoSequencia === 'semanal') return addDias(parsed, indice * 7);
  if (tipoSequencia === 'mensal') return addMeses(parsed, indice);
  if (tipoSequencia === 'anual') return addAnos(parsed, indice);
  return parsed;
}

/**
 * @returns {string[]}
 */
export function gerarDatasSequenciaAgendaLote({ dataBaseBr, tipoSequencia, quantidade = QTD_LINHAS_AGENDAMENTO_LOTE }) {
  const parsed = parseDataBrCompleta(dataBaseBr);
  if (!parsed) return [];
  const qtd = Math.max(1, Math.min(QTD_LINHAS_AGENDAMENTO_LOTE, Number(quantidade) || QTD_LINHAS_AGENDAMENTO_LOTE));
  const out = [];
  for (let i = 0; i < qtd; i++) {
    const bruta = dataStr(avancarData(parsed, tipoSequencia, i));
    out.push(ajustarFimDeSemanaParaSegunda(bruta));
  }
  return out;
}

export function criarLinhaAgendamentoLoteVazia() {
  return { dataBr: '', hora: '', informacao: '' };
}

export function criarLinhasAgendamentoLoteVazias(qtd = QTD_LINHAS_AGENDAMENTO_LOTE) {
  return Array.from({ length: qtd }, () => criarLinhaAgendamentoLoteVazia());
}

/**
 * @param {{ dataBaseBr: string, hora?: string, textoBase?: string, tipoSequencia: string }} opts
 */
export function montarLinhasSequenciaAgendaLote({ dataBaseBr, hora = '', textoBase = '', tipoSequencia }) {
  const datas = gerarDatasSequenciaAgendaLote({ dataBaseBr, tipoSequencia });
  const texto = String(textoBase ?? '').trim();
  const horaNorm = String(hora ?? '').trim();
  const ultimoIdx = datas.length - 1;

  return datas.map((dataBr, idx) => {
    let informacao = texto;
    if (idx === ultimoIdx) {
      informacao = texto ? `${texto} — Último agendamento` : 'Último agendamento';
    }
    return { dataBr, hora: horaNorm, informacao };
  });
}

function extrairInformacaoBaseAgendaLote(informacao) {
  return String(informacao ?? '').replace(/\s*—\s*Último agendamento\s*$/i, '');
}

/** Preenche linhas vazias até 12, preservando edições manuais quando `substituirTudo` é false. */
export function aplicarDatasNasLinhas(linhasAtuais, datasGeradas, { hora = '', textoBase = '' } = {}) {
  const primeira = linhasAtuais?.[0] ?? {};
  const horaNorm = String(primeira.hora ?? '').trim() || String(hora ?? '').trim();
  const texto =
    extrairInformacaoBaseAgendaLote(primeira.informacao) || String(textoBase ?? '').trim();
  const base = Array.isArray(linhasAtuais) ? [...linhasAtuais] : criarLinhasAgendamentoLoteVazias();
  while (base.length < QTD_LINHAS_AGENDAMENTO_LOTE) base.push(criarLinhaAgendamentoLoteVazia());

  const ultimoIdx = datasGeradas.length - 1;
  return base.map((linha, idx) => {
    const dataBr = datasGeradas[idx];
    if (!dataBr) return { ...linha, dataBr: '', hora: linha.hora || horaNorm, informacao: linha.informacao };
    let informacao = texto;
    if (idx === ultimoIdx) {
      informacao = texto ? `${texto} — Último agendamento` : 'Último agendamento';
    }
    return {
      dataBr,
      hora: horaNorm || linha.hora || '',
      informacao,
    };
  });
}

export function marcarUltimoAgendamentoNasLinhas(linhas) {
  const lista = (Array.isArray(linhas) ? linhas : []).map((l) => ({ ...l }));
  while (lista.length < QTD_LINHAS_AGENDAMENTO_LOTE) {
    lista.push(criarLinhaAgendamentoLoteVazia());
  }

  const ultimoIdx = QTD_LINHAS_AGENDAMENTO_LOTE - 1;
  const sufixo = 'Último agendamento';
  const ultimaTemData = String(lista[ultimoIdx]?.dataBr ?? '').trim();

  return lista.map((linha, idx) => {
    const infoBase = extrairInformacaoBaseAgendaLote(linha.informacao);
    if (idx === ultimoIdx && ultimaTemData) {
      const texto = infoBase.trim();
      return {
        ...linha,
        informacao: texto ? `${texto} — ${sufixo}` : sufixo,
      };
    }
    return { ...linha, informacao: infoBase };
  });
}
