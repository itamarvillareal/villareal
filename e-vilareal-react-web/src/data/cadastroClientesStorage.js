/**
 * Persistência local dos dados editáveis do Cadastro de Clientes (por código de cliente).
 */

import { CLIENTE_PARA_PESSOA } from './clientesCadastradosMock.js';

export const STORAGE_CADASTRO_CLIENTES_DADOS = 'vilareal:cadastro-clientes-dados:v1';

/** Último código de cliente aberto no Cadastro de Clientes (restaura ao voltar à tela). */
export const STORAGE_ULTIMO_COD_CLIENTE = 'vilareal:cadastro-clientes-ultimo-cod:v1';

/** @returns {string|null} código com 8 dígitos ou null */
export function loadUltimoCodigoCliente() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_ULTIMO_COD_CLIENTE);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'string') return padCliente8Cadastro(parsed);
    if (parsed && typeof parsed.codigo === 'string') return padCliente8Cadastro(parsed.codigo);
    return null;
  } catch {
    return null;
  }
}

export function padCliente8Cadastro(val) {
  const s = String(val ?? '').replace(/\D/g, '');
  const n = s ? Number(s) : 1;
  if (!Number.isFinite(n) || n < 1) return '00000001';
  return String(Math.floor(n)).padStart(8, '0');
}

/** Maior código numérico já referenciado no mapa oficial ou nas chaves persistidas. */
export function obterMaiorCodigoClienteConhecido() {
  let max = 0;
  for (const k of Object.keys(CLIENTE_PARA_PESSOA)) {
    const n = Number(String(k).replace(/\D/g, ''));
    if (Number.isFinite(n) && n > max) max = n;
  }
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(STORAGE_CADASTRO_CLIENTES_DADOS);
      if (!raw) return max;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return max;
      for (const key of Object.keys(parsed)) {
        const n = Number(String(key).replace(/\D/g, ''));
        if (Number.isFinite(n) && n > max) max = n;
      }
    } catch {
      /* ignore */
    }
  }
  return max;
}

/** Próximo código sugerido (maior conhecido + 1), 8 dígitos. */
export function obterProximoCodigoClienteSugerido() {
  return padCliente8Cadastro(obterMaiorCodigoClienteConhecido() + 1);
}

/**
 * Mescla linhas do mock com sobrescritas salvas (mesmo id = mesmo proc).
 * Inclui processos extras só presentes no persistido (ex.: incluídos pelo usuário).
 */
export function mergeProcessosLista(mockProcessos, persistedProcessos) {
  if (!Array.isArray(mockProcessos) || mockProcessos.length === 0) {
    return Array.isArray(persistedProcessos) ? [...persistedProcessos] : [];
  }
  if (!Array.isArray(persistedProcessos) || persistedProcessos.length === 0) {
    return mockProcessos.map((r) => ({ ...r }));
  }
  const byId = new Map(persistedProcessos.map((p) => [p.id, p]));
  const merged = mockProcessos.map((row) => {
    const o = byId.get(row.id);
    if (!o) return { ...row };
    return {
      ...row,
      processoVelho: o.processoVelho !== undefined ? o.processoVelho : row.processoVelho,
      processoNovo: o.processoNovo !== undefined ? o.processoNovo : row.processoNovo,
      parteOposta: o.parteOposta !== undefined ? o.parteOposta : row.parteOposta,
      descricao: o.descricao !== undefined ? o.descricao : row.descricao,
      autor: o.autor !== undefined ? o.autor : row.autor,
      reu: o.reu !== undefined ? o.reu : row.reu,
      tipoAcao: o.tipoAcao !== undefined ? o.tipoAcao : row.tipoAcao,
      procNumero: row.procNumero,
    };
  });
  const mockIds = new Set(mockProcessos.map((r) => r.id));
  const extras = persistedProcessos.filter((p) => p && p.id && !mockIds.has(p.id));
  return [...merged, ...extras];
}

export function loadCadastroClienteDados(codClienteRaw) {
  const key = padCliente8Cadastro(codClienteRaw);
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_CADASTRO_CLIENTES_DADOS);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const row = parsed[key];
    if (!row || typeof row !== 'object') return null;
    return row;
  } catch {
    return null;
  }
}

/**
 * @param {string} codClienteRaw
 * @param {{
 *   pessoa?: string,
 *   nomeRazao?: string,
 *   cnpjCpf?: string,
 *   observacao?: string,
 *   clienteInativo?: boolean,
 *   edicaoDesabilitada?: boolean,
 *   processos?: Array<object>,
 * }} dados
 */
export function saveCadastroClienteDados(codClienteRaw, dados) {
  const key = padCliente8Cadastro(codClienteRaw);
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(STORAGE_CADASTRO_CLIENTES_DADOS);
    const parsed = raw ? JSON.parse(raw) : {};
    const bag = parsed && typeof parsed === 'object' ? parsed : {};
    const prev = bag[key] && typeof bag[key] === 'object' ? bag[key] : {};
    bag[key] = {
      ...prev,
      ...dados,
      atualizadoEm: new Date().toISOString(),
    };
    window.localStorage.setItem(STORAGE_CADASTRO_CLIENTES_DADOS, JSON.stringify(bag));
    try {
      window.localStorage.setItem(STORAGE_ULTIMO_COD_CLIENTE, JSON.stringify({ codigo: key }));
    } catch {
      /* ignore */
    }
  } catch {
    /* quota */
  }
}
