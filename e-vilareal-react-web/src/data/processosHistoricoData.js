import { getMockProcesso10x10 } from './processosMock.js';

const STORAGE_KEY = 'vilareal:processos-historico:v1';

/** Versão do pacote de dados demo (incremente para reaplicar chaves novas em quem já rodou seed). */
export const DEMO_SEED_VERSION = 3;
const DEMO_SEED_VERSION_KEY = 'vilareal:processos-historico:demo-seed-version';

/**
 * Datas usadas nos registros demo — alinhe os campos iniciais da tela Diagnósticos a estes valores para testar sem ajustar nada.
 */
export const DEMO_DATA_CONSULTA_BR = '19/03/2026';
export const DEMO_DATA_PRAZO_FATAL_BR = '19/03/2026';
export const DEMO_DATA_CONSULTA_ALT_BR = '20/03/2026';

/** ID no cadastro de pessoas mock usado em vínculo demo (Parte Cliente). */
export const DEMO_PESSOA_ID_EXEMPLO = 1;

function apenasDigitos(v) {
  return String(v ?? '').replace(/\D/g, '');
}

function normalizarCodCliente(codCliente) {
  const digits = apenasDigitos(codCliente);
  const n = Number(digits || '1');
  return String(Number.isFinite(n) && n > 0 ? n : 1).padStart(8, '0');
}

function normalizarProc(proc) {
  const n = Number(String(proc ?? '').replace(/\D/g, ''));
  return String(Number.isFinite(n) && n > 0 ? Math.floor(n) : 1);
}

function makeKey(codCliente, proc) {
  return `${normalizarCodCliente(codCliente)}:${normalizarProc(proc)}`;
}

function normalizarIdsPartes(val) {
  if (val == null) return [];
  if (!Array.isArray(val)) return [];
  const s = new Set();
  for (const x of val) {
    const n = Number(x);
    if (Number.isFinite(n) && n > 0) s.add(Math.floor(n));
  }
  return Array.from(s).sort((a, b) => a - b);
}

function normalizarTextoPessoa(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/** Normaliza data dd/mm/aaaa (aceita 1 ou 2 dígitos em dia/mês) para comparação e exibição. */
export function normalizarDataBr(s) {
  const t = String(s ?? '').trim();
  if (!t) return '';
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return t;
  const dd = String(Number(m[1])).padStart(2, '0');
  const mm = String(Number(m[2])).padStart(2, '0');
  const yyyy = m[3];
  return `${dd}/${mm}/${yyyy}`;
}

function loadStore() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}

function saveStore(store) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignora erro de persistência para não quebrar UI.
  }
}

function normalizarHistoricoItem(item) {
  if (!item || typeof item !== 'object') return null;
  const info = String(item.info ?? '').trim();
  if (!info) return null;
  return {
    id: Number(item.id) || Date.now(),
    inf: String(item.inf ?? ''),
    info,
    data: String(item.data ?? ''),
    usuario: String(item.usuario ?? ''),
    numero: String(item.numero ?? ''),
  };
}

function normalizarRegistroProcesso(reg) {
  if (!reg || typeof reg !== 'object') return null;
  const codCliente = normalizarCodCliente(reg.codCliente);
  const proc = normalizarProc(reg.proc);
  const historico = Array.isArray(reg.historico)
    ? reg.historico.map(normalizarHistoricoItem).filter(Boolean)
    : [];

  const prazoRaw = String(reg.prazoFatal ?? '').trim();
  const prazoFatal = prazoRaw ? (normalizarDataBr(prazoRaw) || prazoRaw) : '';

  return {
    codCliente,
    proc,
    cliente: String(reg.cliente ?? ''),
    parteCliente: String(reg.parteCliente ?? ''),
    parteOposta: String(reg.parteOposta ?? ''),
    numeroProcessoNovo: String(reg.numeroProcessoNovo ?? ''),
    prazoFatal,
    faseSelecionada: String(reg.faseSelecionada ?? '').trim(),
    parteClienteIds: normalizarIdsPartes(reg.parteClienteIds),
    parteOpostaIds: normalizarIdsPartes(reg.parteOpostaIds),
    historico,
  };
}

function upsertRegistroProcesso(payload) {
  const current = loadStore();
  const key = makeKey(payload.codCliente, payload.proc);
  const prev = current[key] || {};
  const mergedRaw = {
    ...prev,
    ...payload,
    codCliente: payload.codCliente ?? prev.codCliente,
    proc: payload.proc ?? prev.proc,
    historico: payload.historico !== undefined ? payload.historico : (prev.historico ?? []),
    prazoFatal: payload.prazoFatal !== undefined ? payload.prazoFatal : prev.prazoFatal,
    parteClienteIds: payload.parteClienteIds !== undefined ? payload.parteClienteIds : prev.parteClienteIds,
    parteOpostaIds: payload.parteOpostaIds !== undefined ? payload.parteOpostaIds : prev.parteOpostaIds,
    faseSelecionada: payload.faseSelecionada !== undefined ? payload.faseSelecionada : prev.faseSelecionada,
  };
  const merged = normalizarRegistroProcesso(mergedRaw);
  if (!merged) return null;
  current[key] = merged;
  saveStore(current);
  return merged;
}

export function getRegistroProcesso(codCliente, proc) {
  const current = loadStore();
  const key = makeKey(codCliente, proc);
  return normalizarRegistroProcesso(current[key]);
}

export function getHistoricoDoProcesso(codCliente, proc) {
  const reg = getRegistroProcesso(codCliente, proc);
  return reg?.historico || [];
}

export function seedHistoricoDoProcesso(payload) {
  const existing = getHistoricoDoProcesso(payload.codCliente, payload.proc);
  if (existing.length > 0) return existing;
  const merged = upsertRegistroProcesso(payload);
  return merged?.historico || [];
}

export function salvarHistoricoDoProcesso(payload) {
  const merged = upsertRegistroProcesso(payload);
  return merged?.historico || [];
}

/**
 * Persiste apenas o Prazo Fatal (dd/mm/aaaa) vinculado ao processo, preservando histórico existente.
 */
export function salvarPrazoFatalDoProcesso(codCliente, proc, prazoFatalBr, dadosExtras = {}) {
  const current = loadStore();
  const key = makeKey(codCliente, proc);
  const prevRaw = current[key];
  const prev = normalizarRegistroProcesso(prevRaw) || {
    codCliente: normalizarCodCliente(codCliente),
    proc: normalizarProc(proc),
    cliente: '',
    parteCliente: '',
    parteOposta: '',
    numeroProcessoNovo: '',
    prazoFatal: '',
    parteClienteIds: [],
    parteOpostaIds: [],
    faseSelecionada: '',
    historico: [],
  };
  const pf = String(prazoFatalBr ?? '').trim();
  const prazoNorm = pf ? (normalizarDataBr(pf) || pf) : '';
  return upsertRegistroProcesso({
    ...prev,
    ...dadosExtras,
    codCliente: prev.codCliente,
    proc: prev.proc,
    cliente: dadosExtras.cliente != null ? dadosExtras.cliente : prev.cliente,
    parteCliente: dadosExtras.parteCliente != null ? dadosExtras.parteCliente : prev.parteCliente,
    parteOposta: dadosExtras.parteOposta != null ? dadosExtras.parteOposta : prev.parteOposta,
    numeroProcessoNovo: dadosExtras.numeroProcessoNovo != null ? dadosExtras.numeroProcessoNovo : prev.numeroProcessoNovo,
    historico: prev.historico || [],
    prazoFatal: prazoNorm,
  });
}

export function listarHistoricoPorData(dataBr) {
  const target = String(dataBr ?? '').trim();
  if (!target) return [];
  const out = [];
  const current = loadStore();
  Object.values(current).forEach((rawReg) => {
    const reg = normalizarRegistroProcesso(rawReg);
    if (!reg) return;
    reg.historico.forEach((h) => {
      if (String(h.data ?? '').trim() !== target) return;
      out.push({
        codCliente: reg.codCliente,
        proc: reg.proc,
        cliente: reg.cliente,
        parteCliente: reg.parteCliente,
        parteOposta: reg.parteOposta,
        numeroProcessoNovo: reg.numeroProcessoNovo,
        ...h,
      });
    });
  });
  out.sort((a, b) => (Number(b.numero) || 0) - (Number(a.numero) || 0));
  return out;
}

/**
 * Lista processos em que a pessoa (cadastro) participa — por ID nas partes vinculadas
 * e/ou pelo nome quando informado (fallback para texto em Parte Cliente / Oposta).
 */
export function listarProcessosPorIdPessoa(idPessoa, nomeCadastro) {
  const idStr = String(idPessoa ?? '').trim().replace(/\D/g, '');
  const idNum = Number(idStr);
  const temId = Number.isFinite(idNum) && idNum >= 1;
  const nomeN = normalizarTextoPessoa(nomeCadastro);
  const temNome = nomeN.length > 0;
  if (!temId && !temNome) return [];

  const out = [];
  const current = loadStore();
  Object.values(current).forEach((rawReg) => {
    const reg = normalizarRegistroProcesso(rawReg);
    if (!reg) return;
    const matchIdCliente = temId && reg.parteClienteIds.includes(idNum);
    const matchIdOposta = temId && reg.parteOpostaIds.includes(idNum);
    const matchNomeCliente = temNome && normalizarTextoPessoa(reg.parteCliente).includes(nomeN);
    const matchNomeOposta = temNome && normalizarTextoPessoa(reg.parteOposta).includes(nomeN);
    if (!matchIdCliente && !matchIdOposta && !matchNomeCliente && !matchNomeOposta) return;
    const papeis = [];
    if (matchIdCliente || matchNomeCliente) papeis.push('Parte Cliente');
    if (matchIdOposta || matchNomeOposta) papeis.push('Parte Oposta');
    out.push({
      codCliente: reg.codCliente,
      proc: reg.proc,
      cliente: reg.cliente,
      parteCliente: reg.parteCliente,
      parteOposta: reg.parteOposta,
      numeroProcessoNovo: reg.numeroProcessoNovo,
      papeis: [...new Set(papeis)].join(' · '),
    });
  });
  out.sort((a, b) => {
    const ka = `${a.codCliente}-${String(a.proc).padStart(4, '0')}`;
    const kb = `${b.codCliente}-${String(b.proc).padStart(4, '0')}`;
    return ka.localeCompare(kb);
  });
  return out;
}

/** Indica se a fase gravada corresponde a “Aguardando / Ag. Documentos” (alinha rótulo do Diagnóstico e da tela Processos). */
export function registroEmFaseAguardandoDocumentos(fase) {
  const s = String(fase ?? '').trim();
  if (!s) return false;
  if (s === 'Ag. Documentos') return true;
  const t = normalizarTextoPessoa(s);
  if (t.includes('aguardando') && t.includes('document')) return true;
  const c = t.replace(/[^a-z0-9]/g, '');
  return c.startsWith('ag') && c.includes('docu') && (c.includes('ment') || c.includes('met'));
}

/** Todos os processos persistidos cuja fase é “Aguardando Documentos” / “Ag. Documentos”. */
export function listarProcessosFaseAguardandoDocumentos() {
  const out = [];
  const current = loadStore();
  Object.values(current).forEach((rawReg) => {
    const reg = normalizarRegistroProcesso(rawReg);
    if (!reg) return;
    if (!registroEmFaseAguardandoDocumentos(reg.faseSelecionada)) return;
    out.push({
      codCliente: reg.codCliente,
      proc: reg.proc,
      cliente: reg.cliente,
      parteCliente: reg.parteCliente,
      parteOposta: reg.parteOposta,
      numeroProcessoNovo: reg.numeroProcessoNovo,
      faseSelecionada: reg.faseSelecionada,
    });
  });
  out.sort((a, b) => {
    const ka = `${a.codCliente}-${String(a.proc).padStart(4, '0')}`;
    const kb = `${b.codCliente}-${String(b.proc).padStart(4, '0')}`;
    return ka.localeCompare(kb);
  });
  return out;
}

/** Indica se a fase gravada corresponde a “Aguardando Peticionar” / “Ag. Peticionar” (alinha Processos.jsx). */
export function registroEmFaseAguardandoPeticionar(fase) {
  const s = String(fase ?? '').trim();
  if (!s) return false;
  if (s === 'Ag. Peticionar') return true;
  const t = normalizarTextoPessoa(s);
  if (t.includes('aguardando') && t.includes('petic')) return true;
  const c = t.replace(/[^a-z0-9]/g, '');
  return (
    c.startsWith('ag') &&
    c.includes('petic') &&
    (c.includes('ar') || c.includes('ionar') || c.includes('icion'))
  );
}

/** Todos os processos persistidos cuja fase é Aguardando Peticionar / Ag. Peticionar. */
export function listarProcessosFaseAguardandoPeticionar() {
  const out = [];
  const current = loadStore();
  Object.values(current).forEach((rawReg) => {
    const reg = normalizarRegistroProcesso(rawReg);
    if (!reg) return;
    if (!registroEmFaseAguardandoPeticionar(reg.faseSelecionada)) return;
    out.push({
      codCliente: reg.codCliente,
      proc: reg.proc,
      cliente: reg.cliente,
      parteCliente: reg.parteCliente,
      parteOposta: reg.parteOposta,
      numeroProcessoNovo: reg.numeroProcessoNovo,
      faseSelecionada: reg.faseSelecionada,
    });
  });
  out.sort((a, b) => {
    const ka = `${a.codCliente}-${String(a.proc).padStart(4, '0')}`;
    const kb = `${b.codCliente}-${String(b.proc).padStart(4, '0')}`;
    return ka.localeCompare(kb);
  });
  return out;
}

/** Indica se a fase gravada corresponde a “Aguardando Verificação” / “Ag. Verificação” (alinha Processos.jsx). */
export function registroEmFaseAguardandoVerificacao(fase) {
  const s = String(fase ?? '').trim();
  if (!s) return false;
  if (s === 'Ag. Verificação') return true;
  const t = normalizarTextoPessoa(s);
  if (t.includes('aguardando') && t.includes('verif')) return true;
  const c = t.replace(/[^a-z0-9]/g, '');
  return c.startsWith('ag') && (c.includes('verif') || c.includes('verificacao'));
}

/** Todos os processos persistidos cuja fase é Aguardando Verificação / Ag. Verificação. */
export function listarProcessosFaseAguardandoVerificacao() {
  const out = [];
  const current = loadStore();
  Object.values(current).forEach((rawReg) => {
    const reg = normalizarRegistroProcesso(rawReg);
    if (!reg) return;
    if (!registroEmFaseAguardandoVerificacao(reg.faseSelecionada)) return;
    out.push({
      codCliente: reg.codCliente,
      proc: reg.proc,
      cliente: reg.cliente,
      parteCliente: reg.parteCliente,
      parteOposta: reg.parteOposta,
      numeroProcessoNovo: reg.numeroProcessoNovo,
      faseSelecionada: reg.faseSelecionada,
    });
  });
  out.sort((a, b) => {
    const ka = `${a.codCliente}-${String(a.proc).padStart(4, '0')}`;
    const kb = `${b.codCliente}-${String(b.proc).padStart(4, '0')}`;
    return ka.localeCompare(kb);
  });
  return out;
}

/**
 * Fase “Aguardando Protocolo” no Diagnóstico ↔ rádio “Protocolo / Movimentação” em Processos.jsx
 * (detecção compacta: protoc + moviment).
 */
export function registroEmFaseAguardandoProtocolo(fase) {
  const s = String(fase ?? '').trim();
  if (!s) return false;
  if (s === 'Protocolo / Movimentação') return true;
  const t = normalizarTextoPessoa(s);
  if (t.includes('aguardando') && t.includes('protoc')) return true;
  const c = t.replace(/[^a-z0-9]/g, '');
  return c.includes('protoc') && c.includes('moviment');
}

/** Processos na fase de protocolo / movimentação (ou “Aguardando Protocolo”). */
export function listarProcessosFaseAguardandoProtocolo() {
  const out = [];
  const current = loadStore();
  Object.values(current).forEach((rawReg) => {
    const reg = normalizarRegistroProcesso(rawReg);
    if (!reg) return;
    if (!registroEmFaseAguardandoProtocolo(reg.faseSelecionada)) return;
    out.push({
      codCliente: reg.codCliente,
      proc: reg.proc,
      cliente: reg.cliente,
      parteCliente: reg.parteCliente,
      parteOposta: reg.parteOposta,
      numeroProcessoNovo: reg.numeroProcessoNovo,
      faseSelecionada: reg.faseSelecionada,
    });
  });
  out.sort((a, b) => {
    const ka = `${a.codCliente}-${String(a.proc).padStart(4, '0')}`;
    const kb = `${b.codCliente}-${String(b.proc).padStart(4, '0')}`;
    return ka.localeCompare(kb);
  });
  return out;
}

/** Fase “Aguardando Providência” (mesmo rótulo em Processos.jsx). */
export function registroEmFaseAguardandoProvidencia(fase) {
  const s = String(fase ?? '').trim();
  if (!s) return false;
  if (s === 'Aguardando Providência') return true;
  const t = normalizarTextoPessoa(s);
  if (t.includes('aguardando') && t.includes('provid')) return true;
  const c = t.replace(/[^a-z0-9]/g, '');
  return c.startsWith('ag') && c.includes('provid');
}

/** Processos na fase Aguardando Providência. */
export function listarProcessosFaseAguardandoProvidencia() {
  const out = [];
  const current = loadStore();
  Object.values(current).forEach((rawReg) => {
    const reg = normalizarRegistroProcesso(rawReg);
    if (!reg) return;
    if (!registroEmFaseAguardandoProvidencia(reg.faseSelecionada)) return;
    out.push({
      codCliente: reg.codCliente,
      proc: reg.proc,
      cliente: reg.cliente,
      parteCliente: reg.parteCliente,
      parteOposta: reg.parteOposta,
      numeroProcessoNovo: reg.numeroProcessoNovo,
      faseSelecionada: reg.faseSelecionada,
    });
  });
  out.sort((a, b) => {
    const ka = `${a.codCliente}-${String(a.proc).padStart(4, '0')}`;
    const kb = `${b.codCliente}-${String(b.proc).padStart(4, '0')}`;
    return ka.localeCompare(kb);
  });
  return out;
}

/**
 * Fase “Proc. Administrativo” no Diagnóstico ↔ “Procedimento Adm.” em Processos.jsx.
 * Evita coincidir com “Protocolo / Movimentação” (ex.: compacto com “proc” + “administr” mas sem “protocolo”).
 */
export function registroEmFaseProcedimentoAdministrativo(fase) {
  const s = String(fase ?? '').trim();
  if (!s) return false;
  if (s === 'Procedimento Adm.') return true;
  const t = normalizarTextoPessoa(s);
  const c = t.replace(/[^a-z0-9]/g, '');
  if (c.includes('proced') && (c.includes('adm') || c.includes('administr'))) return true;
  if (c.includes('administr') && c.includes('proc') && !c.includes('protocolo')) return true;
  return false;
}

/** Processos na fase Procedimento Adm. / administrativo. */
export function listarProcessosFaseProcedimentoAdministrativo() {
  const out = [];
  const current = loadStore();
  Object.values(current).forEach((rawReg) => {
    const reg = normalizarRegistroProcesso(rawReg);
    if (!reg) return;
    if (!registroEmFaseProcedimentoAdministrativo(reg.faseSelecionada)) return;
    out.push({
      codCliente: reg.codCliente,
      proc: reg.proc,
      cliente: reg.cliente,
      parteCliente: reg.parteCliente,
      parteOposta: reg.parteOposta,
      numeroProcessoNovo: reg.numeroProcessoNovo,
      faseSelecionada: reg.faseSelecionada,
    });
  });
  out.sort((a, b) => {
    const ka = `${a.codCliente}-${String(a.proc).padStart(4, '0')}`;
    const kb = `${b.codCliente}-${String(b.proc).padStart(4, '0')}`;
    return ka.localeCompare(kb);
  });
  return out;
}

/** Processos com Prazo Fatal na data informada (dd/mm/aaaa). */
export function listarProcessosPorPrazoFatal(dataBr) {
  const target = normalizarDataBr(String(dataBr ?? '').trim());
  if (!target) return [];
  const out = [];
  const current = loadStore();
  Object.values(current).forEach((rawReg) => {
    const reg = normalizarRegistroProcesso(rawReg);
    if (!reg) return;
    const pf = String(reg.prazoFatal ?? '').trim();
    if (!pf) return;
    const pfNorm = normalizarDataBr(pf) || pf;
    if (pfNorm !== target) return;
    out.push({
      codCliente: reg.codCliente,
      proc: reg.proc,
      cliente: reg.cliente,
      parteCliente: reg.parteCliente,
      parteOposta: reg.parteOposta,
      numeroProcessoNovo: reg.numeroProcessoNovo,
      prazoFatal: pfNorm,
    });
  });
  out.sort((a, b) => {
    const ka = `${a.codCliente}-${String(a.proc).padStart(4, '0')}`;
    const kb = `${b.codCliente}-${String(b.proc).padStart(4, '0')}`;
    return ka.localeCompare(kb);
  });
  return out;
}

const FASES_DEMO_DIAGNOSTICO = [
  'Ag. Documentos',
  'Ag. Peticionar',
  'Ag. Verificação',
  'Protocolo / Movimentação',
  'Aguardando Providência',
  'Procedimento Adm.',
];

function montarHistoricoDemo(procNum) {
  const base = [
    {
      id: 920000 + procNum,
      inf: '10',
      info: `Consulta / andamento registrado (demo Diagnósticos — proc. ${procNum})`,
      data: DEMO_DATA_CONSULTA_BR,
      usuario: 'DEMO',
      numero: String(200 + procNum).padStart(4, '0'),
    },
  ];
  if (procNum === 1) {
    base.push({
      id: 920011,
      inf: '09',
      info: 'Segunda movimentação no mesmo dia (teste Consultas Realizadas)',
      data: DEMO_DATA_CONSULTA_BR,
      usuario: 'KARLA',
      numero: '0199',
    });
  }
  if (procNum <= 3) {
    base.push({
      id: 920030 + procNum,
      inf: '08',
      info: 'Lançamento em data alternativa (use 20/03/2026 no modal para comparar)',
      data: DEMO_DATA_CONSULTA_ALT_BR,
      usuario: 'DEMO',
      numero: '0188',
    });
  }
  return base;
}

/**
 * Garante registros no localStorage para testar Diagnósticos (fases, histórico por data, prazo fatal, busca por pessoa).
 * - Sem `force`: só cria chaves que ainda não existem (não sobrescreve uso real).
 * - Com `force`: sobrescreve as chaves do pacote demo (clientes 1–3, processos indicados).
 */
export function ensureHistoricoDemonstracaoDiagnostico(options = {}) {
  if (typeof window === 'undefined') return { ok: false, reason: 'no-window' };
  let force = options.force === true;

  // Se a versão do seed no localStorage é antiga, re-criamos/atualizamos as chaves demo
  // (inclusive vínculo `parteClienteIds`) para o cenário ficar consistente.
  let prev = 0;
  try {
    prev = Number(window.localStorage.getItem(DEMO_SEED_VERSION_KEY) || '0');
  } catch {
    /* ignora */
  }

  if (!force && prev >= DEMO_SEED_VERSION) return { ok: true, skipped: true };
  if (!force && prev < DEMO_SEED_VERSION) force = true;

  const snapshot = loadStore();
  let inseridos = 0;
  let atualizados = 0;

  const aplicar = (spec) => {
    const mock = getMockProcesso10x10(spec.codCliente, spec.proc);
    if (!mock) return;
    const key = makeKey(spec.codCliente, spec.proc);
    const exists = Object.prototype.hasOwnProperty.call(snapshot, key);
    if (!force && exists) return;

    upsertRegistroProcesso({
      codCliente: mock.codigoCliente,
      proc: mock.processo,
      cliente: mock.autor,
      parteCliente: spec.parteCliente ?? mock.parteCliente,
      parteOposta: spec.parteOposta ?? mock.parteOposta,
      numeroProcessoNovo: mock.numeroProcessoNovo,
      historico: spec.historico,
      prazoFatal: spec.prazoFatal ?? '',
      faseSelecionada: spec.faseSelecionada,
      parteClienteIds: spec.parteClienteIds ?? [],
      parteOpostaIds: spec.parteOpostaIds ?? [],
    });
    if (exists) atualizados += 1;
    else inseridos += 1;
  };

  for (let p = 1; p <= 6; p += 1) {
    aplicar({
      codCliente: 1,
      proc: p,
      faseSelecionada: FASES_DEMO_DIAGNOSTICO[p - 1],
      prazoFatal: p <= 4 ? DEMO_DATA_PRAZO_FATAL_BR : '',
      historico: montarHistoricoDemo(p),
      parteClienteIds: p === 1 ? [DEMO_PESSOA_ID_EXEMPLO] : [],
    });
  }

  aplicar({
    codCliente: 2,
    proc: 1,
    faseSelecionada: 'Ag. Documentos',
    prazoFatal: DEMO_DATA_PRAZO_FATAL_BR,
    historico: montarHistoricoDemo(1),
    parteClienteIds: [],
  });

  aplicar({
    codCliente: 3,
    proc: 2,
    faseSelecionada: 'Em Andamento',
    prazoFatal: '',
    historico: [
      {
        id: 920500,
        inf: '05',
        info: 'Processo em andamento — histórico na data demo',
        data: DEMO_DATA_CONSULTA_BR,
        usuario: 'DEMO',
        numero: '0500',
      },
    ],
    // Para garantir que a “Busca pessoa” mostre também como Parte Oposta
    // (ex.: pessoa 1 vinculada como parte oposta em algum processo demo).
    parteOpostaIds: [DEMO_PESSOA_ID_EXEMPLO],
  });

  try {
    window.localStorage.setItem(DEMO_SEED_VERSION_KEY, String(DEMO_SEED_VERSION));
  } catch {
    /* ignora */
  }

  return { ok: true, inseridos, atualizados, force };
}

/** Remove a marca de versão e reaplica todo o pacote demo (reset de cenário de teste). */
export function reaplicarDemonstracaoDiagnostico() {
  if (typeof window === 'undefined') return { ok: false, reason: 'no-window' };
  try {
    window.localStorage.removeItem(DEMO_SEED_VERSION_KEY);
  } catch {
    /* ignora */
  }
  return ensureHistoricoDemonstracaoDiagnostico({ force: true });
}
