/**
 * Sincronização agenda → histórico local (audiência), incluindo:
 * - agenda em localStorage;
 * - agenda na API (todos os usuários, intervalo amplo);
 * - números de processo vindos da API de processos para casar CNJ quando o histórico local está vazio/incompleto.
 */

import { featureFlags } from '../config/featureFlags.js';
import { padCliente } from '../data/processosDadosRelatorio.js';
import {
  listarEntradasAgendaPorMesAnoPersistida,
  listarTodasEntradasAgendaPersistida,
} from '../data/agendaPersistenciaData.js';
import {
  listarRegistrosProcessosHistoricoNormalizados,
  sincronizarAudienciasAgendaEntradas,
} from '../data/processosHistoricoData.js';
import { listarEventosAgendaPeriodoTodosUsuariosApi } from '../repositories/agendaRepository.js';
import { listarClientesCadastro } from '../repositories/clientesRepository.js';
import { listarProcessosPorCodigoCliente, mapApiProcessoToUiShape } from '../repositories/processosRepository.js';

function chaveMatchDeRegistro(reg) {
  const cod = padCliente(reg.codCliente ?? '1');
  const proc = Math.max(1, Math.floor(Number(String(reg.proc ?? '').replace(/\D/g, '')) || 1));
  return `${cod}:${proc}`;
}

/**
 * Objeto no formato esperado por `encontrarProcessosHistoricoPorTextoAgenda` (valores do `Object.values`).
 */
export async function montarStoreObjetoParaMatchCnjMescladoComApi() {
  const store = {};
  for (const reg of listarRegistrosProcessosHistoricoNormalizados()) {
    const key = chaveMatchDeRegistro(reg);
    store[key] = {
      codCliente: reg.codCliente,
      proc: reg.proc,
      numeroProcessoNovo: reg.numeroProcessoNovo,
      numeroProcessoVelho: reg.numeroProcessoVelho,
    };
  }
  if (!featureFlags.useApiProcessos || typeof window === 'undefined') return store;
  try {
    const clientes = await listarClientesCadastro();
    const lista = Array.isArray(clientes) ? clientes : [];
    for (const row of lista) {
      const cod = padCliente(row?.codigo ?? row?.codigoCliente ?? '1');
      let procs = [];
      try {
        procs = await listarProcessosPorCodigoCliente(cod);
      } catch {
        continue;
      }
      for (const raw of procs || []) {
        const ui = mapApiProcessoToUiShape(raw);
        const procNum = Number(ui.numeroInterno);
        if (!Number.isFinite(procNum) || procNum < 1) continue;
        const key = `${cod}:${procNum}`;
        const prev = store[key] || {};
        const novo = String(ui.numeroProcessoNovo ?? '').trim();
        const velho = String(ui.numeroProcessoVelho ?? '').trim();
        store[key] = {
          ...prev,
          codCliente: cod,
          proc: String(procNum),
          numeroProcessoNovo: String(prev.numeroProcessoNovo || '').trim() || novo,
          numeroProcessoVelho: String(prev.numeroProcessoVelho || '').trim() || velho,
        };
      }
    }
  } catch {
    /* mantém só o que veio do histórico local */
  }
  return store;
}

/**
 * Spring/Jackson pode devolver `LocalDate` como string, array [ano, mês, dia] ou objeto.
 */
function dataEventoApiParaDataBr(data) {
  if (data == null) return '';
  if (typeof data === 'string' && /^\d{4}-\d{2}-\d{2}/.test(data)) {
    const [y, m, d] = data.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
  if (Array.isArray(data) && data.length >= 3) {
    const y = data[0];
    const m = String(data[1]).padStart(2, '0');
    const d = String(data[2]).padStart(2, '0');
    if (Number.isFinite(Number(y))) return `${d}/${m}/${y}`;
  }
  if (typeof data === 'object' && data.year != null) {
    const y = Number(data.year);
    const m = String(Number(data.monthValue ?? data.month ?? 1)).padStart(2, '0');
    const d = String(Number(data.dayOfMonth ?? data.day ?? 1)).padStart(2, '0');
    if (Number.isFinite(y)) return `${d}/${m}/${y}`;
  }
  return '';
}

function mapApiAgendaLinhaParaEventoComData(e) {
  const dataBr = dataEventoApiParaDataBr(e.dataEvento);
  return {
    id: String(e.id ?? ''),
    usuarioId: String(e.usuarioId ?? ''),
    hora: e.horaEvento ? String(e.horaEvento).slice(0, 5) : '',
    descricao: String(e.descricao ?? ''),
    processoRef: e.processoRef != null ? String(e.processoRef).trim() : '',
    origem: String(e.origem ?? ''),
    dataBr,
  };
}

function agruparEventosAgendaPorDataBr(eventosComData) {
  const m = new Map();
  for (const x of eventosComData) {
    const db = x.dataBr;
    if (!db) continue;
    const { dataBr: _d, ...ev } = x;
    if (!m.has(db)) m.set(db, []);
    m.get(db).push(ev);
  }
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function intervaloPadraoBuscaAgendaApi() {
  const h = new Date();
  const ini = new Date(h.getFullYear() - 2, h.getMonth(), 1);
  const fim = new Date(h.getFullYear() + 2, h.getMonth() + 1, 0);
  const f = (d) => d.toISOString().slice(0, 10);
  return { dataInicio: f(ini), dataFim: f(fim) };
}

function mergearResultadosSync(a, b) {
  return {
    ok: a.ok !== false && b.ok !== false,
    processosAtualizados: (a.processosAtualizados || 0) + (b.processosAtualizados || 0),
    eventosAgendaEnriquecidos: (a.eventosAgendaEnriquecidos || 0) + (b.eventosAgendaEnriquecidos || 0),
    ignoradosSemPadraoCnj: (a.ignoradosSemPadraoCnj || 0) + (b.ignoradosSemPadraoCnj || 0),
    ignoradosSemMatchNaBase: (a.ignoradosSemMatchNaBase || 0) + (b.ignoradosSemMatchNaBase || 0),
    ignoradosAmbiguos: (a.ignoradosAmbiguos || 0) + (b.ignoradosAmbiguos || 0),
    ignoradosSemRegistro: (a.ignoradosSemRegistro || 0) + (b.ignoradosSemRegistro || 0),
    detalhe: { agendaLocal: a, agendaApi: b },
  };
}

/**
 * Fluxo completo: histórico local + processos na API para match; agenda localStorage + agenda API.
 */
export async function executarSincronizacaoAudienciasAgendaEProcessosCompleta() {
  if (typeof window === 'undefined') {
    return {
      ok: false,
      reason: 'no-window',
      processosAtualizados: 0,
      eventosAgendaEnriquecidos: 0,
      ignoradosSemPadraoCnj: 0,
      ignoradosSemMatchNaBase: 0,
      ignoradosAmbiguos: 0,
      ignoradosSemRegistro: 0,
    };
  }

  const storeMatch = await montarStoreObjetoParaMatchCnjMescladoComApi();
  const optsMatch = {
    storeHistoricoParaMatch: storeMatch,
    criarRegistroSeAusente: true,
  };

  const entradasLoc = listarTodasEntradasAgendaPersistida();
  const rLocal = sincronizarAudienciasAgendaEntradas(entradasLoc, {
    ...optsMatch,
    persistirPatchNaAgendaLocal: true,
  });

  if (!featureFlags.useApiAgenda) {
    return { ...rLocal, detalhe: { agendaLocal: rLocal, agendaApi: null } };
  }

  let rApi = {
    ok: true,
    processosAtualizados: 0,
    eventosAgendaEnriquecidos: 0,
    ignoradosSemPadraoCnj: 0,
    ignoradosSemMatchNaBase: 0,
    ignoradosAmbiguos: 0,
    ignoradosSemRegistro: 0,
  };
  try {
    const { dataInicio, dataFim } = intervaloPadraoBuscaAgendaApi();
    const rows = await listarEventosAgendaPeriodoTodosUsuariosApi(dataInicio, dataFim);
    const mapped = (rows || []).map(mapApiAgendaLinhaParaEventoComData).filter((x) => x.dataBr);
    const entradasApi = agruparEventosAgendaPorDataBr(mapped);
    rApi = sincronizarAudienciasAgendaEntradas(entradasApi, {
      ...optsMatch,
      persistirPatchNaAgendaLocal: false,
    });
  } catch {
    rApi = {
      ok: false,
      reason: 'api-agenda-falha',
      processosAtualizados: 0,
      eventosAgendaEnriquecidos: 0,
      ignoradosSemPadraoCnj: 0,
      ignoradosSemMatchNaBase: 0,
      ignoradosAmbiguos: 0,
      ignoradosSemRegistro: 0,
    };
  }

  return mergearResultadosSync(rLocal, rApi);
}

/**
 * Igual ao completo, mas restringe entradas da agenda local + eventos da API ao mês/ano informados.
 */
export async function executarSincronizacaoAudienciasAgendaMesEProcessos(mes, ano) {
  if (typeof window === 'undefined') {
    return {
      ok: false,
      reason: 'no-window',
      processosAtualizados: 0,
      eventosAgendaEnriquecidos: 0,
      ignoradosSemPadraoCnj: 0,
      ignoradosSemMatchNaBase: 0,
      ignoradosAmbiguos: 0,
      ignoradosSemRegistro: 0,
    };
  }
  const m = Number(mes);
  const y = Number(ano);
  if (!Number.isFinite(m) || m < 1 || m > 12 || !Number.isFinite(y)) {
    return {
      ok: false,
      reason: 'mes-ano-invalido',
      processosAtualizados: 0,
      eventosAgendaEnriquecidos: 0,
      ignoradosSemPadraoCnj: 0,
      ignoradosSemMatchNaBase: 0,
      ignoradosAmbiguos: 0,
      ignoradosSemRegistro: 0,
    };
  }

  const storeMatch = await montarStoreObjetoParaMatchCnjMescladoComApi();
  const optsMatch = {
    storeHistoricoParaMatch: storeMatch,
    criarRegistroSeAusente: true,
  };

  const entradasLoc = listarEntradasAgendaPorMesAnoPersistida(m, y);
  const rLocal = sincronizarAudienciasAgendaEntradas(entradasLoc, {
    ...optsMatch,
    persistirPatchNaAgendaLocal: true,
  });

  if (!featureFlags.useApiAgenda) {
    return { ...rLocal, detalhe: { agendaLocal: rLocal, agendaApi: null } };
  }

  let rApi = {
    ok: true,
    processosAtualizados: 0,
    eventosAgendaEnriquecidos: 0,
    ignoradosSemPadraoCnj: 0,
    ignoradosSemMatchNaBase: 0,
    ignoradosAmbiguos: 0,
    ignoradosSemRegistro: 0,
  };
  try {
    const { dataInicio, dataFim } = intervaloPadraoBuscaAgendaApi();
    const rows = await listarEventosAgendaPeriodoTodosUsuariosApi(dataInicio, dataFim);
    const mm = String(m).padStart(2, '0');
    const filtrados = (rows || []).filter((e) => {
      const br = dataEventoApiParaDataBr(e?.dataEvento);
      if (!/^\d{2}\/\d{2}\/\d{4}$/.test(br)) return false;
      const [, mo, yy] = br.split('/');
      return Number(yy) === y && mo === mm;
    });
    const mapped = filtrados.map(mapApiAgendaLinhaParaEventoComData).filter((x) => x.dataBr);
    const entradasApi = agruparEventosAgendaPorDataBr(mapped);
    rApi = sincronizarAudienciasAgendaEntradas(entradasApi, {
      ...optsMatch,
      persistirPatchNaAgendaLocal: false,
    });
  } catch {
    rApi = {
      ok: false,
      reason: 'api-agenda-falha',
      processosAtualizados: 0,
      eventosAgendaEnriquecidos: 0,
      ignoradosSemPadraoCnj: 0,
      ignoradosSemMatchNaBase: 0,
      ignoradosAmbiguos: 0,
      ignoradosSemRegistro: 0,
    };
  }

  return mergearResultadosSync(rLocal, rApi);
}
