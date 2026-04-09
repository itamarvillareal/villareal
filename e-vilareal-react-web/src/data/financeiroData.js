/**
 * Dados e funções compartilhados do Financeiro (extratos, contas contábeis, Conta Corrente em Processos).
 * Usado por Financeiro e por Processos (janela Conta Corrente).
 *
 * Contas contábeis centrais (letra no extrato → consolidado):
 * - **Letra A → Conta Escritório** — Lançamentos com **A** compõem a conta contábil **Conta Escritório** no consolidado.
 * - **Conta Corrente (Processos)** — Lista **todos** os lançamentos dos extratos com **Cod. Cliente** e **Proc.** iguais
 *   aos do processo em tela (qualquer letra contábil), para refletir o vínculo feito no Financeiro.
 * - **Letra E → Conta Compensação** — Serve para **anular** lançamentos em par: a **soma dos valores** de todas as
 *   linhas com o **mesmo Elo** (identificador numérico natural, ex. 0001, 0002…) deve ser **zero**.
 *   Movimentos que são apenas **mudança de numerário** entre contas bancárias ficam assim concentrados na Compensação,
 *   sem poluir as demais contas contábeis com efeitos líquidos duplicados.
 */

import { getExtratosVinculacaoTestePorBanco } from './vinculacaoAutomaticaTestMock.js';

/** Extratos de exemplo removidos — importe arquivos reais na tela Financeiro. */
const CORA_EXTRATO_MOCK_XLS = [];
const SICOOB_EXTRATO_MOCK_XLS = [];
const ITAU_EMPRESAS_EXTRATO_MOCK_XLS = [];
const SICOOB_VRV_EXTRATO_MOCK_XLS = [];
const BTG_EXTRATO_MOCK_XLS = [];
const BTG_JA_EXTRATO_MOCK_XLS = [];
const BTG_RACHEL_EXTRATO_MOCK_XLS = [];
const BTG_BANKING_EXTRATO_MOCK_XLS = [];
const BB_EXTRATO_MOCK_XLS = [];

const VINC_TESTE_EXTRATOS = {};

function cloneCoraExtratoXlsMock() {
  return JSON.parse(JSON.stringify(CORA_EXTRATO_MOCK_XLS));
}

function cloneSicoobExtratoXlsMock() {
  return JSON.parse(JSON.stringify(SICOOB_EXTRATO_MOCK_XLS));
}

function cloneItauEmpresasExtratoXlsMock() {
  return JSON.parse(JSON.stringify(ITAU_EMPRESAS_EXTRATO_MOCK_XLS));
}

function cloneSicoobVrvExtratoXlsMock() {
  return JSON.parse(JSON.stringify(SICOOB_VRV_EXTRATO_MOCK_XLS));
}

function cloneBtgExtratoXlsMock() {
  return JSON.parse(JSON.stringify(BTG_EXTRATO_MOCK_XLS));
}

function cloneBtgJaExtratoXlsMock() {
  return JSON.parse(JSON.stringify(BTG_JA_EXTRATO_MOCK_XLS));
}

function cloneBtgRachelExtratoXlsMock() {
  return JSON.parse(JSON.stringify(BTG_RACHEL_EXTRATO_MOCK_XLS));
}

function cloneBtgBankingExtratoXlsMock() {
  return JSON.parse(JSON.stringify(BTG_BANKING_EXTRATO_MOCK_XLS));
}

function cloneBbExtratoXlsMock() {
  return JSON.parse(JSON.stringify(BB_EXTRATO_MOCK_XLS));
}

const CEF_EXTRATO_MOCK_PDF = [];

function cloneCefExtratoPdfMock() {
  return JSON.parse(JSON.stringify(CEF_EXTRATO_MOCK_PDF));
}

const LETRA_TO_CONTA = {
  A: 'Conta Escritório',
  B: 'Conta Trabalhos Extras',
  C: 'Conta Pessoal',
  D: 'Conta Veredas',
  N: 'Conta Não Identificados',
  E: 'Conta Compensação',
  F: 'Conta Fundos Investimentos',
  M: 'Conta Marcenaria',
  R: 'Conta Rachel',
  P: 'Conta Pessoa Jurídica',
  I: 'Conta Imóveis',
  J: 'Conta Julio',
};

const CONTA_TO_LETRA = Object.fromEntries(Object.entries(LETRA_TO_CONTA).map(([k, v]) => [v, k]));

const BANCO_TO_NUMERO = {
  'Itaú': 1, 'Bradesco': 2, 'BB': 3, 'Sicoob': 4, 'CEF': 5, 'Itaú Poupança': 6,
  'Mastercard': 7, 'Visa': 8, 'LANÇ MANUAIS': 9, 'Poupança Bradesco': 10,
  'Mercado Pago': 11, 'CEF Poupança': 12, 'Nubank': 13, 'PicPay': 14, 'PicPay Rachel': 15,
  'Mastercard Sicoob': 16, 'LANÇ EM DINHEIRO': 17, 'LANÇ MANUAIS (2)': 18,
  'Mastercard Black': 19, 'BTG Cartão': 20, 'BTG': 21, 'ITI': 22, 'Itaú Empresas': 23,
  'BTG Banking': 24, 'BTG (2)': 25, 'CORA': 26, 'BTG JA': 27, 'BTG RACHEL': 28, 'Sicoob VRV': 29,
};

/** Extratos iniciais vazios (sem dados de demonstração). */
const MOCK_EXTRATOS_POR_BANCO = Object.fromEntries(Object.keys(BANCO_TO_NUMERO).map((k) => [k, []]));

export const STORAGE_FINANCEIRO_EXTRATOS_KEY = 'vilareal.financeiro.extratos.v20';
/** Chave anterior; migrada para v20 com extrato Itaú PF zerado (remove mocks/XLS antigos persistidos). */
const STORAGE_FINANCEIRO_EXTRATOS_V19 = 'vilareal.financeiro.extratos.v19';
const STORAGE_FINANCEIRO_EXTRATOS_V18 = 'vilareal.financeiro.extratos.v18';
const STORAGE_FINANCEIRO_EXTRATOS_V17 = 'vilareal.financeiro.extratos.v17';
const STORAGE_FINANCEIRO_EXTRATOS_V16 = 'vilareal.financeiro.extratos.v16';
const STORAGE_FINANCEIRO_EXTRATOS_V15 = 'vilareal.financeiro.extratos.v15';
const STORAGE_FINANCEIRO_EXTRATOS_V14 = 'vilareal.financeiro.extratos.v14';
const STORAGE_FINANCEIRO_EXTRATOS_V13 = 'vilareal.financeiro.extratos.v13';
const STORAGE_FINANCEIRO_EXTRATOS_V12 = 'vilareal.financeiro.extratos.v12';
const STORAGE_FINANCEIRO_EXTRATOS_V11 = 'vilareal.financeiro.extratos.v11';
const STORAGE_FINANCEIRO_EXTRATOS_V10 = 'vilareal.financeiro.extratos.v10';
const STORAGE_FINANCEIRO_EXTRATOS_V9 = 'vilareal.financeiro.extratos.v9';
const STORAGE_FINANCEIRO_EXTRATOS_V8 = 'vilareal.financeiro.extratos.v8';
const STORAGE_FINANCEIRO_EXTRATOS_V7 = 'vilareal.financeiro.extratos.v7';
const STORAGE_KEYS_EXTRATO_LEGACY = [
  'vilareal.financeiro.extratos.v6',
  'vilareal.financeiro.extratos.v5',
  'vilareal.financeiro.extratos.v4',
  'vilareal.financeiro.extratos.v3',
  'vilareal.financeiro.extratos.v2',
  'vilareal.financeiro.extratos.v1',
];

function safeJsonParseFinanceiro(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/**
 * Ref. no Financeiro (extrato e consolidado): apenas **N** ou **R**.
 * N = lançamento único (sem repasse vinculado). R = repasse — exige par(es) com o mesmo **Eq.**.
 * Valores legados (vazio, "675", etc.) tratam-se como **N**.
 */
export function normalizarRefFinanceiro(raw) {
  const s = String(raw ?? '').trim().toUpperCase();
  if (s === 'R') return 'R';
  return 'N';
}

/** Migra extratos persistidos: Ref. só N/R; legado vazio/675 → N; com N limpa Eq./Dimensão. */
function migrarRefLegadoExtratos(data) {
  if (!data || typeof data !== 'object') return data;
  const out = {};
  for (const [banco, list] of Object.entries(data)) {
    if (!Array.isArray(list)) {
      out[banco] = list;
      continue;
    }
    out[banco] = list.map((t) => {
      if (!t || typeof t !== 'object') return t;
      const ref = normalizarRefFinanceiro(t.ref);
      if (ref === 'N') {
        return { ...t, ref: 'N', eq: '', dimensao: '' };
      }
      return { ...t, ref: 'R' };
    });
  }
  return out;
}

function extratosTodosArraysVazios(obj) {
  const out = { ...obj };
  for (const k of Object.keys(out)) {
    if (Array.isArray(out[k])) out[k] = [];
  }
  return out;
}

function removerChavesExtratoLegadoFinanceiro() {
  try {
    window.localStorage.removeItem(STORAGE_FINANCEIRO_EXTRATOS_V19);
    window.localStorage.removeItem(STORAGE_FINANCEIRO_EXTRATOS_V18);
    window.localStorage.removeItem(STORAGE_FINANCEIRO_EXTRATOS_V17);
    window.localStorage.removeItem(STORAGE_FINANCEIRO_EXTRATOS_V16);
    window.localStorage.removeItem(STORAGE_FINANCEIRO_EXTRATOS_V15);
    window.localStorage.removeItem(STORAGE_FINANCEIRO_EXTRATOS_V14);
    window.localStorage.removeItem(STORAGE_FINANCEIRO_EXTRATOS_V13);
    window.localStorage.removeItem(STORAGE_FINANCEIRO_EXTRATOS_V12);
    window.localStorage.removeItem(STORAGE_FINANCEIRO_EXTRATOS_V11);
    window.localStorage.removeItem(STORAGE_FINANCEIRO_EXTRATOS_V10);
    window.localStorage.removeItem(STORAGE_FINANCEIRO_EXTRATOS_V9);
    window.localStorage.removeItem(STORAGE_FINANCEIRO_EXTRATOS_V8);
    window.localStorage.removeItem(STORAGE_FINANCEIRO_EXTRATOS_V7);
    for (const k of STORAGE_KEYS_EXTRATO_LEGACY) {
      window.localStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

function aplicarMocksInstituicoesVazias(data) {
  if (!data || typeof data !== 'object') return data;
  const d = { ...data };
  const vinc = getExtratosVinculacaoTestePorBanco();
  if (!Array.isArray(d.CEF) || d.CEF.length === 0) {
    d.CEF = [...cloneCefExtratoPdfMock(), ...(Array.isArray(vinc.CEF) ? vinc.CEF : [])];
  }
  if (!Array.isArray(d['Itaú']) || d['Itaú'].length === 0) {
    d['Itaú'] = [];
  }
  if (!Array.isArray(d.CORA) || d.CORA.length === 0) {
    d.CORA = [...cloneCoraExtratoXlsMock(), ...(Array.isArray(vinc.CORA) ? vinc.CORA : [])];
  }
  if (!Array.isArray(d.BB) || d.BB.length === 0) d.BB = cloneBbExtratoXlsMock();
  if (!Array.isArray(d.Sicoob) || d.Sicoob.length === 0) d.Sicoob = cloneSicoobExtratoXlsMock();
  if (!Array.isArray(d['Itaú Empresas']) || d['Itaú Empresas'].length === 0) {
    d['Itaú Empresas'] = cloneItauEmpresasExtratoXlsMock();
  }
  if (!Array.isArray(d['Sicoob VRV']) || d['Sicoob VRV'].length === 0) {
    d['Sicoob VRV'] = cloneSicoobVrvExtratoXlsMock();
  }
  if (!Array.isArray(d.BTG) || d.BTG.length === 0) d.BTG = cloneBtgExtratoXlsMock();
  if (!Array.isArray(d['BTG Banking']) || d['BTG Banking'].length === 0) {
    d['BTG Banking'] = cloneBtgBankingExtratoXlsMock();
  }
  if (!Array.isArray(d['BTG JA']) || d['BTG JA'].length === 0) {
    d['BTG JA'] = cloneBtgJaExtratoXlsMock();
  }
  if (!Array.isArray(d['BTG RACHEL']) || d['BTG RACHEL'].length === 0) {
    d['BTG RACHEL'] = cloneBtgRachelExtratoXlsMock();
  }
  if (!Array.isArray(d.Nubank) || d.Nubank.length === 0) {
    d.Nubank = [...(Array.isArray(vinc.Nubank) ? vinc.Nubank : [])];
  }
  if (!Array.isArray(d.PicPay) || d.PicPay.length === 0) {
    d.PicPay = [...(Array.isArray(vinc.PicPay) ? vinc.PicPay : [])];
  }
  return d;
}

/**
 * Persistência v20. Migração a partir de v19 (zera extrato Itaú PF persistido) e anteriores.
 */
export function loadPersistedExtratosFinanceiro() {
  if (typeof window === 'undefined') return null;
  try {
    const raw20 = window.localStorage.getItem(STORAGE_FINANCEIRO_EXTRATOS_KEY);
    if (raw20) {
      const p = safeJsonParseFinanceiro(raw20);
      if (p?.data && typeof p.data === 'object' && p.v === 20) {
        return mergePersistedComLancamentosVinculacaoTeste(p.data);
      }
    }
    const rawV19Legado = window.localStorage.getItem(STORAGE_FINANCEIRO_EXTRATOS_V19);
    if (rawV19Legado) {
      const p = safeJsonParseFinanceiro(rawV19Legado);
      if (p?.data && typeof p.data === 'object' && p.v === 19) {
        const cleared = { ...p.data, 'Itaú': [] };
        const out = mergePersistedComLancamentosVinculacaoTeste(cleared);
        out['Itaú'] = [];
        window.localStorage.setItem(
          STORAGE_FINANCEIRO_EXTRATOS_KEY,
          JSON.stringify({ v: 20, data: out })
        );
        window.localStorage.removeItem(STORAGE_FINANCEIRO_EXTRATOS_V19);
        removerChavesExtratoLegadoFinanceiro();
        return out;
      }
    }
    const tryMigrate = (raw, version) => {
      const parsed = safeJsonParseFinanceiro(raw);
      if (!parsed?.data || typeof parsed.data !== 'object' || parsed.v !== version) return null;
      const merged = { ...getExtratosIniciais(), ...parsed.data };
      return migrarRefLegadoExtratos(aplicarMocksInstituicoesVazias(merged));
    };
    const saveV20 = (out) => {
      window.localStorage.setItem(STORAGE_FINANCEIRO_EXTRATOS_KEY, JSON.stringify({ v: 20, data: out }));
      removerChavesExtratoLegadoFinanceiro();
    };
    const raw18ls = window.localStorage.getItem(STORAGE_FINANCEIRO_EXTRATOS_V18);
    if (raw18ls) {
      const out = tryMigrate(raw18ls, 18);
      if (out) {
        saveV20(out);
        return out;
      }
    }
    const raw17 = window.localStorage.getItem(STORAGE_FINANCEIRO_EXTRATOS_V17);
    if (raw17) {
      const out = tryMigrate(raw17, 17);
      if (out) {
        saveV20(out);
        return out;
      }
    }
    const raw16 = window.localStorage.getItem(STORAGE_FINANCEIRO_EXTRATOS_V16);
    if (raw16) {
      const out = tryMigrate(raw16, 16);
      if (out) {
        saveV20(out);
        return out;
      }
    }
    const raw15 = window.localStorage.getItem(STORAGE_FINANCEIRO_EXTRATOS_V15);
    if (raw15) {
      const out = tryMigrate(raw15, 15);
      if (out) {
        saveV20(out);
        return out;
      }
    }
    const raw14 = window.localStorage.getItem(STORAGE_FINANCEIRO_EXTRATOS_V14);
    if (raw14) {
      const out = tryMigrate(raw14, 14);
      if (out) {
        saveV20(out);
        return out;
      }
    }
    const raw13 = window.localStorage.getItem(STORAGE_FINANCEIRO_EXTRATOS_V13);
    if (raw13) {
      const out = tryMigrate(raw13, 13);
      if (out) {
        saveV20(out);
        return out;
      }
    }
    const raw12 = window.localStorage.getItem(STORAGE_FINANCEIRO_EXTRATOS_V12);
    if (raw12) {
      const out = tryMigrate(raw12, 12);
      if (out) {
        saveV20(out);
        return out;
      }
    }
    const raw11 = window.localStorage.getItem(STORAGE_FINANCEIRO_EXTRATOS_V11);
    if (raw11) {
      const out = tryMigrate(raw11, 11);
      if (out) {
        saveV20(out);
        return out;
      }
    }
    const raw10 = window.localStorage.getItem(STORAGE_FINANCEIRO_EXTRATOS_V10);
    if (raw10) {
      const out = tryMigrate(raw10, 10);
      if (out) {
        saveV20(out);
        return out;
      }
    }
    const raw9 = window.localStorage.getItem(STORAGE_FINANCEIRO_EXTRATOS_V9);
    if (raw9) {
      const out = tryMigrate(raw9, 9);
      if (out) {
        saveV20(out);
        return out;
      }
    }
    const raw8 = window.localStorage.getItem(STORAGE_FINANCEIRO_EXTRATOS_V8);
    if (raw8) {
      const out = tryMigrate(raw8, 8);
      if (out) {
        saveV20(out);
        return out;
      }
    }
    const sources = [STORAGE_FINANCEIRO_EXTRATOS_V7, ...STORAGE_KEYS_EXTRATO_LEGACY];
    for (const key of sources) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = safeJsonParseFinanceiro(raw);
      if (!parsed?.data || typeof parsed.data !== 'object') continue;
      const base = getExtratosIniciais();
      const merged = { ...base, ...parsed.data };
      const limpo = extratosTodosArraysVazios(merged);
      limpo.CEF = cloneCefExtratoPdfMock();
      limpo['Itaú'] = [];
      limpo['Itaú Empresas'] = cloneItauEmpresasExtratoXlsMock();
      limpo.CORA = cloneCoraExtratoXlsMock();
      limpo.BB = cloneBbExtratoXlsMock();
      limpo.Sicoob = cloneSicoobExtratoXlsMock();
      limpo['Sicoob VRV'] = cloneSicoobVrvExtratoXlsMock();
      limpo.BTG = cloneBtgExtratoXlsMock();
      limpo['BTG Banking'] = cloneBtgBankingExtratoXlsMock();
      limpo['BTG JA'] = cloneBtgJaExtratoXlsMock();
      limpo['BTG RACHEL'] = cloneBtgRachelExtratoXlsMock();
      const limpoMigrado = migrarRefLegadoExtratos(limpo);
      window.localStorage.setItem(
        STORAGE_FINANCEIRO_EXTRATOS_KEY,
        JSON.stringify({ v: 20, data: limpoMigrado })
      );
      removerChavesExtratoLegadoFinanceiro();
      return limpoMigrado;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function savePersistedExtratosFinanceiro(data) {
  if (typeof window === 'undefined') return;
  try {
    const payload = migrarRefLegadoExtratos(data);
    window.localStorage.setItem(STORAGE_FINANCEIRO_EXTRATOS_KEY, JSON.stringify({ v: 20, data: payload }));
    removerChavesExtratoLegadoFinanceiro();
  } catch {
    /* ignore */
  }
}

/** Nomes de instituição cujo extrato foi marcado como inativo (conta encerrada — não atualiza por OFX). */
export const STORAGE_FINANCEIRO_EXTRATOS_INATIVOS_KEY = 'vilareal.financeiro.extratos.inativos.v1';

/**
 * @returns {string[]} nomes de bancos inativos (ordenados)
 */
export function loadPersistedExtratosInativosFinanceiro() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_FINANCEIRO_EXTRATOS_INATIVOS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((x) => typeof x === 'string').sort();
  } catch {
    return [];
  }
}

export function savePersistedExtratosInativosFinanceiro(nomes) {
  if (typeof window === 'undefined') return;
  try {
    const arr = Array.isArray(nomes) ? [...nomes].filter((x) => typeof x === 'string').sort() : [];
    window.localStorage.setItem(STORAGE_FINANCEIRO_EXTRATOS_INATIVOS_KEY, JSON.stringify(arr));
  } catch {
    /* ignore */
  }
}

/** Contas bancárias criadas pelo usuário: nome exibido + número sequencial (Nº no consolidado). */
export const STORAGE_FINANCEIRO_CONTAS_EXTRAS_KEY = 'vilareal.financeiro.contasExtras.v1';

/**
 * @returns {Array<{ nome: string, numero: number }>}
 */
export function loadPersistedContasExtrasFinanceiro() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_FINANCEIRO_CONTAS_EXTRAS_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw);
    if (p?.v === 1 && Array.isArray(p.contas)) {
      return p.contas.filter(
        (c) => c && typeof c.nome === 'string' && c.nome.trim() && Number.isFinite(c.numero) && c.numero >= 1
      );
    }
  } catch {
    /* ignore */
  }
  return [];
}

export function savePersistedContasExtrasFinanceiro(contas) {
  if (typeof window === 'undefined') return;
  try {
    const arr = Array.isArray(contas)
      ? contas.filter(
          (c) => c && typeof c.nome === 'string' && c.nome.trim() && Number.isFinite(c.numero) && c.numero >= 1
        )
      : [];
    window.localStorage.setItem(STORAGE_FINANCEIRO_CONTAS_EXTRAS_KEY, JSON.stringify({ v: 1, contas: arr }));
  } catch {
    /* ignore */
  }
}

/** Maior número já usado entre o mapa base e as contas extras (para próximo sequencial). */
export function maxNumeroBancoCadastrado(contasExtras) {
  const baseMax = Math.max(...Object.values(BANCO_TO_NUMERO));
  const em = Array.isArray(contasExtras) ? contasExtras : [];
  const exMax = em.reduce((m, c) => (c && Number.isFinite(c.numero) ? Math.max(m, c.numero) : m), 0);
  return Math.max(baseMax, exMax);
}

export function proximoNumeroContaBanco(contasExtras) {
  return maxNumeroBancoCadastrado(contasExtras) + 1;
}

/** Mapa nome → número para o consolidado (base + contas adicionadas pelo usuário). */
export function buildNumeroBancoMap(contasExtrasList) {
  const map = { ...BANCO_TO_NUMERO };
  for (const c of contasExtrasList || []) {
    if (c && typeof c.nome === 'string' && c.nome.trim() && Number.isFinite(c.numero)) {
      map[c.nome.trim()] = c.numero;
    }
  }
  return map;
}

export function getBancoNumeroMapMerged() {
  return buildNumeroBancoMap(loadPersistedContasExtrasFinanceiro());
}

/**
 * @returns {{ ok: true, nome: string } | { ok: false, message: string }}
 */
export function validarNovoNomeContaBancaria(nomeRaw, contasExtras) {
  const nome = String(nomeRaw ?? '').trim();
  if (!nome) return { ok: false, message: 'Informe um nome para a conta.' };
  if (nome.length > 80) return { ok: false, message: 'Nome muito longo (máx. 80 caracteres).' };
  if (Object.prototype.hasOwnProperty.call(BANCO_TO_NUMERO, nome)) {
    return { ok: false, message: 'Já existe uma instituição padrão com esse nome.' };
  }
  const outras = Array.isArray(contasExtras) ? contasExtras : [];
  if (outras.some((c) => c.nome === nome)) {
    return { ok: false, message: 'Já existe uma conta adicionada com esse nome.' };
  }
  return { ok: true, nome };
}

/** Letras reservadas para novas contas contábeis (não colidem com A–J, N, P, R do plano base). */
const LETRAS_POOL_CONTA_CONTABIL_EXTRA = ['G', 'H', 'K', 'L', 'O', 'Q', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

export const STORAGE_FINANCEIRO_CONTAS_CONTABEIS_EXTRAS_KEY = 'vilareal.financeiro.contasContabeis.extras.v1';
export const STORAGE_FINANCEIRO_CONTAS_CONTABEIS_INATIVAS_KEY = 'vilareal.financeiro.contasContabeis.inativas.v1';

/**
 * @returns {Array<{ letra: string, nome: string }>}
 */
export function loadPersistedContasContabeisExtrasFinanceiro() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_FINANCEIRO_CONTAS_CONTABEIS_EXTRAS_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw);
    if (p?.v === 1 && Array.isArray(p.contas)) {
      return p.contas.filter(
        (c) =>
          c &&
          typeof c.letra === 'string' &&
          c.letra.trim() &&
          typeof c.nome === 'string' &&
          c.nome.trim()
      );
    }
  } catch {
    /* ignore */
  }
  return [];
}

export function savePersistedContasContabeisExtrasFinanceiro(contas) {
  if (typeof window === 'undefined') return;
  try {
    const arr = Array.isArray(contas)
      ? contas.filter(
          (c) =>
            c &&
            typeof c.letra === 'string' &&
            c.letra.trim() &&
            typeof c.nome === 'string' &&
            c.nome.trim()
        )
      : [];
    window.localStorage.setItem(STORAGE_FINANCEIRO_CONTAS_CONTABEIS_EXTRAS_KEY, JSON.stringify({ v: 1, contas: arr }));
  } catch {
    /* ignore */
  }
}

/** @returns {string[]} nomes de contas contábeis inativas (padrão ou adicionadas). */
export function loadPersistedContasContabeisInativasFinanceiro() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_FINANCEIRO_CONTAS_CONTABEIS_INATIVAS_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw);
    if (p?.v === 1 && Array.isArray(p.nomes)) {
      return p.nomes.filter((x) => typeof x === 'string').sort();
    }
  } catch {
    /* ignore */
  }
  return [];
}

export function savePersistedContasContabeisInativasFinanceiro(nomes) {
  if (typeof window === 'undefined') return;
  try {
    const arr = Array.isArray(nomes) ? [...nomes].filter((x) => typeof x === 'string').sort() : [];
    window.localStorage.setItem(
      STORAGE_FINANCEIRO_CONTAS_CONTABEIS_INATIVAS_KEY,
      JSON.stringify({ v: 1, nomes: arr })
    );
  } catch {
    /* ignore */
  }
}

export function buildLetraToContaMerge(contasContabeisExtras) {
  const m = { ...LETRA_TO_CONTA };
  for (const c of contasContabeisExtras || []) {
    if (c?.letra && c?.nome?.trim()) {
      m[String(c.letra).trim().toUpperCase()] = c.nome.trim();
    }
  }
  return m;
}

export function buildContaToLetraMerge(contasContabeisExtras) {
  const m = { ...CONTA_TO_LETRA };
  for (const c of contasContabeisExtras || []) {
    if (c?.letra && c?.nome?.trim()) {
      m[c.nome.trim()] = String(c.letra).trim().toUpperCase();
    }
  }
  return m;
}

/** Ordem das letras do plano padrão (exportada para a UI). */
export const ORDEM_LETRA_CONTA_BASE = ['A', 'B', 'C', 'D', 'N', 'E', 'F', 'M', 'R', 'P', 'I', 'J'];

export function buildOrdemLetrasContabeisCompleta(contasContabeisExtras) {
  const extras = Array.isArray(contasContabeisExtras) ? contasContabeisExtras : [];
  const letrasExtras = extras.map((c) => String(c.letra ?? '').trim().toUpperCase()).filter(Boolean);
  return [...ORDEM_LETRA_CONTA_BASE, ...letrasExtras];
}

export function proximaLetraContaContabilExtra(contasContabeisExtras) {
  const usadas = new Set(Object.keys(LETRA_TO_CONTA));
  for (const c of contasContabeisExtras || []) {
    const L = String(c?.letra ?? '').trim().toUpperCase();
    if (L) usadas.add(L);
  }
  for (const L of LETRAS_POOL_CONTA_CONTABIL_EXTRA) {
    if (!usadas.has(L)) return L;
  }
  return null;
}

/**
 * @returns {{ ok: true, nome: string } | { ok: false, message: string }}
 */
export function validarNovoNomeContaContabil(nomeRaw, contasContabeisExtras) {
  const nome = String(nomeRaw ?? '').trim();
  if (!nome) return { ok: false, message: 'Informe um nome para a conta contábil.' };
  if (nome.length > 80) return { ok: false, message: 'Nome muito longo (máx. 80 caracteres).' };
  const valoresBase = new Set(Object.values(LETRA_TO_CONTA));
  if (valoresBase.has(nome)) {
    return { ok: false, message: 'Já existe uma conta padrão com esse nome.' };
  }
  if ((contasContabeisExtras || []).some((c) => c.nome === nome)) {
    return { ok: false, message: 'Já existe uma conta adicionada com esse nome.' };
  }
  return { ok: true, nome };
}

function cloneExtratos(extratos) {
  return JSON.parse(JSON.stringify(extratos));
}

/** Base: mocks por banco (Itaú PF vazio); depois pareamento interbancário. */
function getExtratosIniciais() {
  return parearCompensacaoInterbancaria(cloneExtratos(MOCK_EXTRATOS_POR_BANCO));
}

/**
 * Reinsere nos extratos persistidos os lançamentos de teste de vinculação automática (nº 88000–88049)
 * quando faltarem (exceto Itaú PF — extrato real só via OFX/importação).
 * O Financeiro faz `{ ...getExtratosIniciais(), ...persisted }`, então o storage substitui por banco
 * e removia esses lançamentos — a busca automática deixava de achar pares data/valor.
 */
export function mergePersistedComLancamentosVinculacaoTeste(persisted) {
  if (!persisted || typeof persisted !== 'object') return persisted;
  const out = { ...persisted };
  for (const [nomeBanco, listVinc] of Object.entries(VINC_TESTE_EXTRATOS)) {
    if (nomeBanco === 'Itaú') continue;
    if (!Array.isArray(listVinc) || listVinc.length === 0) continue;
    const arr = Array.isArray(out[nomeBanco]) ? out[nomeBanco] : [];
    const keys = new Set(arr.map((t) => `${String(t.numero)}|${String(t.data)}`));
    const extras = listVinc.filter((t) => !keys.has(`${String(t.numero)}|${String(t.data)}`));
    if (extras.length) {
      out[nomeBanco] = [...arr, ...extras.map((t) => JSON.parse(JSON.stringify(t)))];
    }
  }
  return migrarRefLegadoExtratos(out);
}

/** Valor monetário exato em centavos (sem tolerância em reais). */
function centavos(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/** Dois valores se compensam somente se forem opostos exatos (mesmo módulo em centavos). */
function valoresCompensamExatos(v1, v2) {
  const c1 = centavos(v1);
  const c2 = centavos(v2);
  if (c1 === null || c2 === null) return false;
  if (c1 === 0 || c2 === 0) return false;
  return c1 + c2 === 0;
}

function maiorIdParCompensacao(extratosPorBanco) {
  let m = 0;
  for (const list of Object.values(extratosPorBanco)) {
    for (const t of list) {
      if (t.letra !== 'E') continue;
      const ps = String(t.proc ?? '').trim();
      if (!/^\d+$/.test(ps)) continue;
      const n = parseInt(ps, 10);
      if (!Number.isNaN(n) && n > m) m = n;
    }
  }
  return m;
}

function eloFormatado(n) {
  return String(Math.max(1, n)).padStart(4, '0');
}

function lancamentoElegivelParearCompensacao(t) {
  const c = centavos(t.valor);
  if (!t?.data || c === null || c === 0) return false;
  const procS = String(t.proc ?? '').trim();
  const orfaoCompensacao = t.letra === 'E' && procS.startsWith('?');
  return t.letra === 'N' || (t.letra === 'E' && !procS) || orfaoCompensacao;
}

/** Pool de lançamentos elegíveis a compensação (mesma regra para detectar e aplicar). */
function montarPoolCompensacao(next) {
  const flat = [];
  for (const [nomeBanco, list] of Object.entries(next)) {
    list.forEach((t, idx) => {
      if (!lancamentoElegivelParearCompensacao(t)) return;
      flat.push({ nomeBanco, idx, t, k: `${nomeBanco}|${t.numero}|${t.data}` });
    });
  }
  flat.sort((a, b) => {
    const da = a.t.data.split('/').reverse().join('-');
    const db = b.t.data.split('/').reverse().join('-');
    const cmp = da.localeCompare(db);
    if (cmp !== 0) return cmp;
    return Math.abs(centavos(b.t.valor)) - Math.abs(centavos(a.t.valor));
  });
  return flat;
}

function resumoPerna(x) {
  return {
    banco: x.nomeBanco,
    numero: x.t.numero,
    data: x.t.data,
    valor: x.t.valor,
    descricao: x.t.descricao || '',
  };
}

/**
 * Identifica pares de compensação sem alterar dados (mesma lógica da aplicação).
 * Elo sugerido: 0001, 0002… a partir do próximo após os já existentes.
 */
export function detectarParesCompensacao(extratosPorBanco) {
  const next = cloneExtratos(extratosPorBanco);
  const flat = montarPoolCompensacao(next);
  const usado = new Set();
  let idPar = maiorIdParCompensacao(next) + 1;
  const pares = [];
  for (const a of flat) {
    if (usado.has(a.k)) continue;
    const parceiro = flat.find((b) => {
      if (usado.has(b.k) || b.k === a.k) return false;
      if (b.nomeBanco === a.nomeBanco) return false;
      if (b.t.data !== a.t.data) return false;
      return valoresCompensamExatos(a.t.valor, b.t.valor);
    });
    if (!parceiro) continue;
    const elo = eloFormatado(idPar++);
    usado.add(a.k);
    usado.add(parceiro.k);
    const ra = resumoPerna(a);
    const rb = resumoPerna(parceiro);
    const credito = ra.valor > 0 ? ra : rb;
    const debito = ra.valor < 0 ? ra : rb;
    pares.push({ elo, data: a.t.data, credito, debito });
  }
  return pares;
}

function aplicarTagParCompensacaoEmLancamento(t) {
  const det = (t.descricaoDetalhada || t.categoria || '').trim();
  const tag = '[Par compensação]';
  if (!det.includes(tag)) {
    const novo = det ? `${det} ${tag}` : tag;
    t.descricaoDetalhada = novo;
    t.categoria = novo;
  }
}

/** Remove a marcação de par (início do texto ou após espaço). */
function removerTagParCompensacaoDeCampo(s) {
  return String(s ?? '')
    .replace(/(?:^|\s)\[Par compensação\]/g, '')
    .trim();
}

function removerTagParCompensacaoEmLancamento(t) {
  t.descricaoDetalhada = removerTagParCompensacaoDeCampo(t.descricaoDetalhada);
  t.categoria = removerTagParCompensacaoDeCampo(t.categoria);
}

/** E em compensação sem proc. numérico vira ?1, ?2… */
function renormalizarOrfaosCompensacao(next) {
  let orphanSeq = 0;
  for (const list of Object.values(next)) {
    for (const t of list) {
      if (t.letra !== 'E') continue;
      const p = String(t.proc || '').trim();
      if (/^\d+$/.test(p)) continue;
      t.codCliente = '';
      t.proc = `?${++orphanSeq}`;
    }
  }
}

function localizarLancamentoExtrato(next, banco, numero, data, valor) {
  const list = next[banco];
  if (!Array.isArray(list)) return null;
  const nc = centavos(valor);
  if (nc === null) return null;
  const i = list.findIndex((t) => {
    if (String(t.numero ?? '') !== String(numero ?? '')) return false;
    if (String(t.data ?? '').trim() !== String(data ?? '').trim()) return false;
    return centavos(t.valor) === nc;
  });
  return i >= 0 ? { list, idx: i, t: list[i] } : null;
}

/**
 * Aplica um único par (como em {@link detectarParesCompensacao}): letra E + próximo Elo disponível.
 * @param {object} par — `{ credito, debito }` com `banco`, `numero`, `data`, `valor` (como no retorno da detecção)
 * @returns {{ ok: true, elo: string, extratos: object } | { ok: false, message: string, extratos: object }}
 */
export function aplicarUmParCompensacaoInterbancaria(extratosPorBanco, par) {
  const next = cloneExtratos(extratosPorBanco);
  if (!par?.credito || !par?.debito) {
    return { ok: false, message: 'Par inválido.', extratos: next };
  }
  const { credito, debito } = par;
  if (credito.banco === debito.banco) {
    return { ok: false, message: 'O par precisa ser entre bancos diferentes.', extratos: next };
  }
  const a = localizarLancamentoExtrato(next, credito.banco, credito.numero, credito.data, credito.valor);
  const b = localizarLancamentoExtrato(next, debito.banco, debito.numero, debito.data, debito.valor);
  if (!a || !b) {
    return {
      ok: false,
      message: 'Não foi possível localizar um dos lançamentos (extrato pode ter mudado). Atualize a lista.',
      extratos: next,
    };
  }
  if (a.t === b.t) {
    return { ok: false, message: 'Lançamento duplicado no mesmo extrato.', extratos: next };
  }
  if (!lancamentoElegivelParearCompensacao(a.t) || !lancamentoElegivelParearCompensacao(b.t)) {
    return {
      ok: false,
      message: 'Um dos lançamentos já foi classificado ou não está mais elegível a compensação.',
      extratos: next,
    };
  }
  if (String(a.t.data).trim() !== String(b.t.data).trim() || !valoresCompensamExatos(a.t.valor, b.t.valor)) {
    return { ok: false, message: 'Data ou valores do par não batem mais.', extratos: next };
  }
  const pid = eloFormatado(maiorIdParCompensacao(next) + 1);
  for (const hit of [a, b]) {
    hit.t.letra = 'E';
    hit.t.codCliente = '';
    hit.t.proc = pid;
    aplicarTagParCompensacaoEmLancamento(hit.t);
  }
  renormalizarOrfaosCompensacao(next);
  return { ok: true, elo: pid, extratos: next };
}

/**
 * Desfaz {@link aplicarUmParCompensacaoInterbancaria}: volta letra N, zera Elo e remove tag de par.
 * @param {string} eloAplicado — valor gravado em `proc` nos dois lançamentos (ex.: "0001")
 */
export function reverterUmParCompensacaoInterbancaria(extratosPorBanco, par, eloAplicado) {
  const next = cloneExtratos(extratosPorBanco);
  const elos = String(eloAplicado ?? '').trim();
  if (!par?.credito || !par?.debito || !elos) {
    return { ok: false, message: 'Dados inválidos para desfazer o vínculo.', extratos: next };
  }
  const { credito, debito } = par;
  const a = localizarLancamentoExtrato(next, credito.banco, credito.numero, credito.data, credito.valor);
  const b = localizarLancamentoExtrato(next, debito.banco, debito.numero, debito.data, debito.valor);
  if (!a || !b || a.t === b.t) {
    return {
      ok: false,
      message: 'Não foi possível localizar os lançamentos (extrato pode ter mudado).',
      extratos: next,
    };
  }
  const pa = String(a.t.proc ?? '').trim();
  const pb = String(b.t.proc ?? '').trim();
  if (a.t.letra !== 'E' || b.t.letra !== 'E' || pa !== elos || pb !== elos) {
    return {
      ok: false,
      message: 'Este par não está vinculado com o Elo esperado ou já foi alterado.',
      extratos: next,
    };
  }
  for (const hit of [a, b]) {
    hit.t.letra = 'N';
    hit.t.proc = '';
    hit.t.codCliente = '';
    removerTagParCompensacaoEmLancamento(hit.t);
  }
  renormalizarOrfaosCompensacao(next);
  return { ok: true, extratos: next };
}

/**
 * Emparelha transferências entre bancos: mesmo dia, valores opostos exatos (centavos), bancos diferentes.
 * Conta Compensação (E): Elo em 4 dígitos (0001, 0002…).
 */
export function parearCompensacaoInterbancaria(extratosPorBanco) {
  const next = cloneExtratos(extratosPorBanco);
  const flat = montarPoolCompensacao(next);
  const usado = new Set();
  let idPar = maiorIdParCompensacao(next) + 1;
  for (const a of flat) {
    if (usado.has(a.k)) continue;
    const parceiro = flat.find((b) => {
      if (usado.has(b.k) || b.k === a.k) return false;
      if (b.nomeBanco === a.nomeBanco) return false;
      if (b.t.data !== a.t.data) return false;
      return valoresCompensamExatos(a.t.valor, b.t.valor);
    });
    if (!parceiro) continue;
    const pid = eloFormatado(idPar++);
    for (const x of [a, parceiro]) {
      usado.add(x.k);
      x.t.letra = 'E';
      x.t.codCliente = '';
      x.t.proc = pid;
      aplicarTagParCompensacaoEmLancamento(x.t);
    }
  }
  renormalizarOrfaosCompensacao(next);
  return next;
}

/**
 * Chamado após importar OFX em qualquer banco: varre todos os extratos e forma novos pares de compensação.
 * Equivale a parearCompensacaoInterbancaria (nome explícito para o fluxo pós-importação).
 */
export function parearCompensacaoAposImportacaoOfx(extratosPorBanco) {
  return parearCompensacaoInterbancaria(extratosPorBanco);
}

/** Soma por Proc. em centavos (0 = par exato). */
export function somasPorParCompensacao(extratosPorBanco, numeroPorBancoMap, contaToLetraMap) {
  const txs = getTransacoesConsolidadas(
    extratosPorBanco,
    'Conta Compensação',
    numeroPorBancoMap,
    contaToLetraMap
  );
  const grupos = {};
  for (const t of txs) {
    const pr = String(t.proc ?? '').trim() || '—';
    const c = centavos(t.valor);
    if (c === null) continue;
    grupos[pr] = (grupos[pr] || 0) + c;
  }
  return grupos;
}

/**
 * Contas contábeis derivadas dos extratos: agrega por letra (conta) todos os bancos.
 * Ordena primeiro as contas com lançamentos (mais movimentadas primeiro), depois as sem uso.
 * @param {Record<string,string>} [letraToContaMap] — plano padrão + contas extras (mesclado)
 * @param {string[]} [ordemLetras] — ordem das letras para desempate
 * @returns {Array<{ letra: string, nome: string, count: number, saldo: number }>}
 */
export function getContasContabeisDerivadasExtratos(extratosPorBanco, letraToContaMap, ordemLetras) {
  const map = letraToContaMap ?? LETRA_TO_CONTA;
  const ordem = ordemLetras ?? ORDEM_LETRA_CONTA_BASE;
  const stats = {};
  for (const letra of Object.keys(map)) {
    stats[letra] = { count: 0, saldo: 0 };
  }
  for (const list of Object.values(extratosPorBanco || {})) {
    if (!Array.isArray(list)) continue;
    for (const t of list) {
      const L = String(t.letra ?? '').trim().toUpperCase();
      if (!stats[L]) continue;
      stats[L].count += 1;
      const v = Number(t.valor);
      if (Number.isFinite(v)) stats[L].saldo += v;
    }
  }
  const items = Object.keys(map).map((letra) => ({
    letra,
    nome: map[letra],
    count: stats[letra].count,
    saldo: stats[letra].saldo,
  }));
  items.sort((a, b) => {
    const ua = a.count > 0 ? 1 : 0;
    const ub = b.count > 0 ? 1 : 0;
    if (ua !== ub) return ub - ua;
    if (a.count !== b.count) return b.count - a.count;
    const ia = ordem.indexOf(a.letra);
    const ib = ordem.indexOf(b.letra);
    const xa = ia === -1 ? 999 : ia;
    const xb = ib === -1 ? 999 : ib;
    if (xa !== xb) return xa - xb;
    return String(a.nome).localeCompare(String(b.nome), 'pt-BR');
  });
  return items;
}

/**
 * Consolida lançamentos cuja letra no extrato corresponde à conta contábil (ex.: A → Conta Escritório, E → Compensação).
 */
export function getTransacoesConsolidadas(extratosPorBanco, contaContabilNome, numeroPorBancoMap, contaToLetraMap) {
  const map = numeroPorBancoMap ?? getBancoNumeroMapMerged();
  const ctl = contaToLetraMap ?? CONTA_TO_LETRA;
  const letra = ctl[contaContabilNome];
  if (!letra) return [];
  const letraU = String(letra).trim().toUpperCase();
  const lista = [];
  for (const [nomeBanco, transacoes] of Object.entries(extratosPorBanco)) {
    for (const t of transacoes) {
      if (String(t.letra ?? '').trim().toUpperCase() === letraU) {
        lista.push({
          ...t,
          nomeBanco,
          numeroBanco: map[nomeBanco] ?? '-',
        });
      }
    }
  }
  return lista.sort((a, b) => a.data.localeCompare(b.data));
}

/** Normaliza código do cliente ou processo para comparação. Retorna '' se vazio ou não numérico. */
export function normalizarCodigoClienteFinanceiro(val) {
  const s = String(val ?? '').trim();
  if (!s) return '';
  const n = Number(s);
  if (Number.isNaN(n) || n < 1) return '';
  return String(n);
}

/** Normaliza número de processo (1–100). Retorna '' se vazio ou não numérico. */
export function normalizarProcFinanceiro(val) {
  const s = String(val ?? '').trim();
  if (!s) return '';
  const n = Number(s);
  if (Number.isNaN(n) || n < 0) return '';
  if (n === 0) return '0';
  return String(n);
}

function normalizarCodigoCliente(val) {
  return normalizarCodigoClienteFinanceiro(val);
}

function normalizarProc(val) {
  return normalizarProcFinanceiro(val);
}

/**
 * Filtra lançamentos já na Conta Escritório (ou lista equivalente) por cliente e processo — mesmo critério da Conta Corrente / conciliação.
 */
export function filtrarTransacoesPorClienteProc(lista, codigoCliente, processo) {
  if (!Array.isArray(lista)) return [];
  const codigoNorm = normalizarCodigoClienteFinanceiro(codigoCliente);
  const procNorm = normalizarProcFinanceiro(processo);
  if (!codigoNorm) return [];
  let filtrado = lista.filter((t) => normalizarCodigoClienteFinanceiro(t.codCliente) === codigoNorm);
  if (procNorm) {
    filtrado = filtrado.filter((t) => normalizarProcFinanceiro(t.proc) === procNorm);
  }
  return filtrado;
}

/**
 * Mesmo texto em "Categoria / Obs." (extrato do banco) e "Descrição / Contraparte" (conta contábil).
 * Unifica categoria e descricaoDetalhada do lançamento (fonte única lógica).
 */
export function textoCategoriaObservacao(t) {
  const c = String(t?.categoria ?? '').trim();
  const d = String(t?.descricaoDetalhada ?? '').trim();
  return c || d;
}

/** Mesmo texto em "Dimensão" (extrato) e "Eq." (consolidado). */
export function textoDimensaoEq(t) {
  const a = String(t?.dimensao ?? '').trim();
  const b = String(t?.eq ?? '').trim();
  return a || b;
}

function lancamentoParaContaCorrenteModal(t) {
  const obs = textoCategoriaObservacao(t);
  return {
    data: t.data,
    descricao: t.descricao,
    dataOuId: t.proc,
    valor: t.valor,
    nome: obs.slice(0, 24) || '—',
    nomeBanco: t.nomeBanco,
    numero: t.numero,
  };
}

/**
 * Lançamentos dos extratos (persistidos + mock) com **Cod. Cliente** e **Proc.** alinhados ao processo em tela,
 * **independente da letra** contábil (A, N, etc.) — reflete o vínculo aplicado no Financeiro.
 * @param {string|number} codigoCliente - Código do cliente exibido em Processos
 * @param {string|number} [processo] - Número do processo exibido em Processos (opcional; se informado, filtra por Proc.)
 * @returns {{ lancamentos: Array<{data, descricao, dataOuId, valor, nome}>, soma: number }}
 */
/** Mesma persistência v8 do Financeiro (OFX, edições Cod./Proc.). */
function getExtratosParaContaCorrente() {
  const base = getExtratosIniciais();
  if (typeof window === 'undefined') return base;
  const persisted = loadPersistedExtratosFinanceiro();
  if (!persisted) return base;
  return { ...base, ...persisted };
}

/**
 * Transações completas dos extratos (mesmo critério da Conta Corrente em Processos), com nome do banco.
 * Usado pela Administração de Imóveis para classificar aluguel / repasse / despesas sem duplicar lançamentos.
 */
export function getTransacoesContaCorrenteCompleto(codigoCliente, processo) {
  const codigoNorm = normalizarCodigoCliente(codigoCliente);
  const procNorm = normalizarProc(processo);
  const extratos = getExtratosParaContaCorrente();
  const map = getBancoNumeroMapMerged();

  if (!codigoNorm) return [];

  const filtrado = [];
  const seen = new Set();
  for (const [nomeBanco, transacoes] of Object.entries(extratos)) {
    if (!Array.isArray(transacoes)) continue;
    for (const t of transacoes) {
      if (normalizarCodigoCliente(t.codCliente) !== codigoNorm) continue;
      if (procNorm !== '') {
        if (normalizarProc(t.proc) !== procNorm) continue;
      }
      const key = `${nomeBanco}|${String(t.numero ?? '')}|${String(t.data ?? '')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      filtrado.push({
        ...t,
        nomeBanco,
        numeroBanco: map[nomeBanco] ?? '-',
      });
    }
  }

  filtrado.sort((a, b) => {
    const byData = String(a.data ?? '').localeCompare(String(b.data ?? ''));
    if (byData !== 0) return byData;
    return Number(a.numero) - Number(b.numero);
  });
  return filtrado;
}

export function getLancamentosContaCorrente(codigoCliente, processo) {
  const filtrado = getTransacoesContaCorrenteCompleto(codigoCliente, processo);
  const soma = filtrado.reduce((s, t) => s + (Number(t.valor) || 0), 0);
  const lancamentos = filtrado.map(lancamentoParaContaCorrenteModal);
  return { lancamentos, soma };
}

/**
 * Inclui na lista da Conta Corrente o lançamento vindo do duplo clique no consolidado (Financeiro),
 * se for Conta Escritório e bater cliente/processo, evitando duplicata (data + nº + banco).
 */
export function mergeContaCorrenteComLinhaOrigem(lancamentos, soma, linhaOrigem, codigoCliente, processo) {
  if (!linhaOrigem) return { lancamentos, soma };
  const codNorm = normalizarCodigoCliente(codigoCliente);
  const procNorm = normalizarProc(processo);
  if (!codNorm || !procNorm) return { lancamentos, soma };
  if (
    normalizarCodigoCliente(linhaOrigem.codCliente) !== codNorm ||
    normalizarProc(linhaOrigem.proc) !== procNorm
  ) {
    return { lancamentos, soma };
  }
  const dup = lancamentos.some(
    (l) =>
      String(l.numero) === String(linhaOrigem.numero) &&
      l.data === linhaOrigem.data &&
      (l.nomeBanco || '') === (linhaOrigem.nomeBanco || '')
  );
  if (dup) return { lancamentos, soma };
  const extra = lancamentoParaContaCorrenteModal({
    ...linhaOrigem,
    nomeBanco: linhaOrigem.nomeBanco,
    proc: linhaOrigem.proc,
  });
  const merged = [...lancamentos, extra].sort((a, b) => {
    const byData = String(a.data ?? '').localeCompare(String(b.data ?? ''));
    if (byData !== 0) return byData;
    return Number(a.numero) - Number(b.numero);
  });
  return { lancamentos: merged, soma: merged.reduce((s, t) => s + t.valor, 0) };
}

export {
  MOCK_EXTRATOS_POR_BANCO,
  CONTA_TO_LETRA,
  LETRA_TO_CONTA,
  BANCO_TO_NUMERO,
  cloneExtratos,
  getExtratosIniciais,
};
