/**
 * Persistência do Relatório de Processos na sessão do navegador (mesma aba).
 * Mantém a grade após navegar para Processos e voltar, sem remontar do zero.
 */

const STORAGE_SESSAO_EMITIDO = 'vilareal.relatorioProcessos.sessao.emitido.v1';
const STORAGE_SESSAO_BASE_RAW = 'vilareal.relatorioProcessos.sessao.baseRaw.v1';
const STORAGE_SESSAO_DADOS = 'vilareal.relatorioProcessos.sessao.dados.v1';
const STORAGE_SESSAO_UI = 'vilareal.relatorioProcessos.sessao.ui.v1';

function readJson(key) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  if (typeof window === 'undefined') return false;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function removeKeys(keys) {
  if (typeof window === 'undefined') return;
  for (const key of keys) {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

/**
 * @returns {{
 *   emitido: boolean,
 *   baseRaw: Array|null,
 *   dados: Array|null,
 *   ui: object|null,
 * }}
 */
export function carregarSessaoRelatorioProcessos() {
  if (typeof window === 'undefined') {
    return { emitido: false, baseRaw: null, dados: null, ui: null };
  }
  try {
    const emitido = window.sessionStorage.getItem(STORAGE_SESSAO_EMITIDO) === '1';
    if (!emitido) {
      return { emitido: false, baseRaw: null, dados: null, ui: null };
    }
    const baseRaw = readJson(STORAGE_SESSAO_BASE_RAW);
    const dados = readJson(STORAGE_SESSAO_DADOS);
    const ui = readJson(STORAGE_SESSAO_UI);
    return {
      emitido: true,
      baseRaw: Array.isArray(baseRaw) ? baseRaw : null,
      dados: Array.isArray(dados) ? dados : null,
      ui: ui && typeof ui === 'object' ? ui : null,
    };
  } catch {
    return { emitido: false, baseRaw: null, dados: null, ui: null };
  }
}

/**
 * @param {{
 *   baseRaw?: Array,
 *   dados?: Array,
 *   ui?: object|null,
 * }} snapshot
 */
export function salvarSessaoRelatorioProcessos(snapshot = {}) {
  if (typeof window === 'undefined') return;
  const baseRaw = Array.isArray(snapshot.baseRaw) ? snapshot.baseRaw : null;
  const dados = Array.isArray(snapshot.dados) ? snapshot.dados : null;
  const ui = snapshot.ui && typeof snapshot.ui === 'object' ? snapshot.ui : null;

  try {
    window.sessionStorage.setItem(STORAGE_SESSAO_EMITIDO, '1');
  } catch {
    return;
  }

  if (ui) writeJson(STORAGE_SESSAO_UI, ui);

  let dadosOk = false;
  if (dados && dados.length > 0) {
    dadosOk = writeJson(STORAGE_SESSAO_DADOS, dados);
    if (!dadosOk) {
      removeKeys([STORAGE_SESSAO_DADOS]);
    }
  }

  if (baseRaw && baseRaw.length > 0) {
    const baseOk = writeJson(STORAGE_SESSAO_BASE_RAW, baseRaw);
    if (!baseOk) {
      removeKeys([STORAGE_SESSAO_BASE_RAW]);
    }
  } else if (!dadosOk) {
    removeKeys([STORAGE_SESSAO_BASE_RAW]);
  }
}

export function limparSessaoRelatorioProcessos() {
  removeKeys([
    STORAGE_SESSAO_EMITIDO,
    STORAGE_SESSAO_BASE_RAW,
    STORAGE_SESSAO_DADOS,
    STORAGE_SESSAO_UI,
  ]);
}
