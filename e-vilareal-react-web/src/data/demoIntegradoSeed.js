/**
 * Pacote demo integrado: Agenda + Financeiro alinhados ao mock 10×10 e ao seed de Processos/Diagnósticos.
 * Pessoas/Clientes: use mock de cadastro + CLIENTE_PARA_PESSOA; Cálculos: rodada de teste 999/88 já vem do storage.
 * Imóveis: `getImovelMock(DEMO_IMOVEL_ID)` — sem localStorage.
 */

import { getMockProcesso10x10 } from './processosMock.js';
import {
  DEMO_DATA_CONSULTA_BR,
  DEMO_DATA_CONSULTA_ALT_BR,
  ensureHistoricoDemonstracaoDiagnostico,
  reaplicarDemonstracaoDiagnostico,
} from './processosHistoricoData.js';
import { agendarAudienciaParaTodosUsuarios } from './agendaPersistenciaData.js';
import {
  getExtratosIniciais,
  loadPersistedExtratosFinanceiro,
  mergePersistedComLancamentosVinculacaoTeste,
  savePersistedExtratosFinanceiro,
} from './financeiroData.js';
import { removerLancamentosAdministracaoImoveisDeCef, mergeCefComAdministracaoImoveisDemo } from './administracaoImoveisExtratoSeed.js';

/** Incremente para reaplicar lançamentos/agenda demo em quem já rodou o pacote. */
export const DEMO_INTEGRADO_VERSION = 2;

const DEMO_INTEGRADO_VERSION_KEY = 'vilareal:demo-integrado:version';

/** Imóvel sugerido para cruzar com telas que usam `getImovelMock(id)`. */
export const DEMO_IMOVEL_ID = 1;

const PREFIXO_DEMO_FIN = 'demo-int-';

function parseDataSort(dataBr) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(dataBr ?? '').trim());
  if (!m) return 0;
  return Number(m[3]) * 10000 + Number(m[2]) * 100 + Number(m[1]);
}

function lancCefDemo({
  numero,
  data,
  descricao,
  valor,
  codCliente,
  proc,
  letra = 'A',
}) {
  return {
    letra,
    numero: String(numero),
    data,
    descricao,
    valor,
    saldo: 0,
    saldoDesc: '',
    descricaoDetalhada: '',
    categoria: '',
    codCliente: String(codCliente ?? ''),
    proc: String(proc ?? ''),
    dimensao: '',
    parcela: '',
    ref: '',
    eq: '',
  };
}

function recomputeSaldoCef(list) {
  let saldo = 0;
  return list.map((t) => {
    saldo += Number(t.valor) || 0;
    return { ...t, saldo };
  });
}

function ordenarCef(list) {
  return [...list].sort((a, b) => {
    const da = parseDataSort(a.data);
    const db = parseDataSort(b.data);
    if (da !== db) return da - db;
    return String(a.numero).localeCompare(String(b.numero), undefined, { numeric: true });
  });
}

function removerLancamentosDemoIntegradoDeCef(cefList) {
  if (!Array.isArray(cefList)) return [];
  return cefList.filter((t) => !String(t?.numero ?? '').startsWith(PREFIXO_DEMO_FIN));
}

function seedAgendaDemoIntegrado() {
  const m11 = getMockProcesso10x10(1, 1);
  const m14 = getMockProcesso10x10(1, 4);
  const m21 = getMockProcesso10x10(2, 1);
  if (m11) {
    agendarAudienciaParaTodosUsuarios({
      audienciaData: DEMO_DATA_CONSULTA_BR,
      audienciaHora: '14:30',
      audienciaTipo: 'Audiência Unificada',
      numeroProcessoNovo: m11.numeroProcessoNovo,
    });
  }
  if (m14) {
    agendarAudienciaParaTodosUsuarios({
      audienciaData: DEMO_DATA_CONSULTA_BR,
      audienciaHora: '09:00',
      audienciaTipo: 'Audiência Unificada',
      numeroProcessoNovo: m14.numeroProcessoNovo,
    });
  }
  if (m21) {
    agendarAudienciaParaTodosUsuarios({
      audienciaData: DEMO_DATA_CONSULTA_ALT_BR,
      audienciaHora: '11:00',
      audienciaTipo: 'Audiência Unificada',
      numeroProcessoNovo: m21.numeroProcessoNovo,
    });
  }
}

function seedFinanceiroDemoIntegrado() {
  const baseRaw = loadPersistedExtratosFinanceiro();
  const base = baseRaw
    ? mergePersistedComLancamentosVinculacaoTeste(JSON.parse(JSON.stringify(baseRaw)))
    : JSON.parse(JSON.stringify(getExtratosIniciais()));
  const out = { ...base };
  let cefAntes = removerLancamentosDemoIntegradoDeCef(Array.isArray(out.CEF) ? out.CEF : []);
  cefAntes = removerLancamentosAdministracaoImoveisDeCef(cefAntes);

  const novos = [
    lancCefDemo({
      numero: `${PREFIXO_DEMO_FIN}001`,
      data: DEMO_DATA_CONSULTA_BR,
      descricao: 'Demo integrado — honorários (cliente 1, proc. 1)',
      valor: -1500,
      codCliente: '00000001',
      proc: '1',
    }),
    lancCefDemo({
      numero: `${PREFIXO_DEMO_FIN}002`,
      data: DEMO_DATA_CONSULTA_BR,
      descricao: 'Demo integrado — custas (cliente 1, proc. 4)',
      valor: -750.5,
      codCliente: '00000001',
      proc: '4',
    }),
    lancCefDemo({
      numero: `${PREFIXO_DEMO_FIN}003`,
      data: DEMO_DATA_CONSULTA_ALT_BR,
      descricao: 'Demo integrado — parcela (cliente 2, proc. 1)',
      valor: -920,
      codCliente: '00000002',
      proc: '1',
    }),
  ];

  const cefComDemoFinanceiro = recomputeSaldoCef(ordenarCef([...cefAntes, ...novos]));
  out.CEF = mergeCefComAdministracaoImoveisDemo(cefComDemoFinanceiro);
  savePersistedExtratosFinanceiro(out);
}

/**
 * Garante histórico de processos (se ainda não estiver na versão atual) + agenda + extratos CEF demo.
 * @param {{ force?: boolean }} options — `force: true` ignora a versão e reaplica agenda/financeiro (útil após reset completo).
 */
export function ensureDemoIntegradoCompleto(options = {}) {
  if (typeof window === 'undefined') return { ok: false, reason: 'no-window' };
  const force = options.force === true;

  let prev = 0;
  try {
    prev = Number(window.localStorage.getItem(DEMO_INTEGRADO_VERSION_KEY) || '0');
  } catch {
    /* ignora */
  }

  if (!force && prev >= DEMO_INTEGRADO_VERSION) {
    return { ok: true, skipped: true };
  }

  try {
    ensureHistoricoDemonstracaoDiagnostico({ force: false });
  } catch {
    /* não bloqueia */
  }

  try {
    seedAgendaDemoIntegrado();
  } catch {
    /* não bloqueia */
  }

  try {
    seedFinanceiroDemoIntegrado();
  } catch {
    /* não bloqueia */
  }

  try {
    window.localStorage.setItem(DEMO_INTEGRADO_VERSION_KEY, String(DEMO_INTEGRADO_VERSION));
  } catch {
    /* ignora */
  }

  return { ok: true, force, prev };
}

/**
 * Reaplica o pacote de Processos/Diagnósticos e, em seguida, o demo integrado (agenda + CEF).
 * Sobrescreve chaves demo de processos; mantém demais dados fora do escopo do seed de diagnóstico.
 */
export function reaplicarDemoIntegradoCompleto() {
  if (typeof window === 'undefined') return { ok: false, reason: 'no-window' };
  try {
    window.localStorage.removeItem(DEMO_INTEGRADO_VERSION_KEY);
  } catch {
    /* ignora */
  }
  const rProc = reaplicarDemonstracaoDiagnostico();
  const rInt = ensureDemoIntegradoCompleto({ force: true });
  return { ok: true, processos: rProc, integrado: rInt };
}
