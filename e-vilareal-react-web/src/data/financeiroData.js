/**
 * Dados e funções compartilhados do Financeiro (extratos, Conta Escritório).
 * Usado por Financeiro e por Processos (janela Conta Corrente).
 */

import { ITAU_EXTRATO_MOCK_XLS } from './itauExtratoMock.js';
import { CORA_EXTRATO_MOCK_XLS } from './coraExtratoMock.js';
import { SICOOB_EXTRATO_MOCK_XLS } from './sicoobExtratoMock.js';
import { ITAU_EMPRESAS_EXTRATO_MOCK_XLS } from './itauEmpresasExtratoMock.js';
import { SICOOB_VRV_EXTRATO_MOCK_XLS } from './sicoobVrvExtratoMock.js';
import { BTG_EXTRATO_MOCK_XLS } from './btgExtratoMock.js';
import { BTG_JA_EXTRATO_MOCK_XLS } from './btgJaExtratoMock.js';
import { BTG_RACHEL_EXTRATO_MOCK_XLS } from './btgRachelExtratoMock.js';
import { BTG_BANKING_EXTRATO_MOCK_XLS } from './btgBankingExtratoMock.js';
import { BB_EXTRATO_MOCK_XLS } from './bbExtratoMock.js';

function cloneItauExtratoXlsMock() {
  return JSON.parse(JSON.stringify(ITAU_EXTRATO_MOCK_XLS));
}

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

function lancCef(letra, numero, data, descricao, valor, saldo, saldoDesc, descricaoDetalhada) {
  return {
    letra,
    numero: String(numero),
    data,
    descricao,
    valor,
    saldo,
    saldoDesc: saldoDesc || '',
    descricaoDetalhada: descricaoDetalhada || '',
    categoria: '',
    codCliente: '',
    proc: '',
    dimensao: '',
    parcela: '',
  };
}

/** Extrato CEF conforme PDF (Conta Corrente Caixa — referência do usuário). */
const CEF_EXTRATO_MOCK_PDF = [
  lancCef('A', '7128', '06/01/2026', 'DP DIN LOT', 1400, 1400, '', 'ITAMAR ALEXANDRE FELIX VILLA REAL JUNIOR x FRANCISCA ARAÚJO GOMES - 01/2026'),
  lancCef('E', '7129', '06/01/2026', 'ENVIO PIX', -1400, 0, '', '15904'),
  lancCef('E', '7130', '26/01/2026', 'CRED PIX', 3078, 3078, '', '15887'),
  lancCef('E', '7131', '26/01/2026', 'ENVIO PIX', -13000, -9922, '', '15955'),
  lancCef('E', '7132', '26/01/2026', 'CRED PIX', 9922, 0, '', '15956'),
  lancCef('E', '7133', '26/01/2026', 'CRED PIX', 3100, 3100, '', '16083'),
  lancCef('I', '7134', '26/01/2026', 'PREST HAB', -3066, 34, '', ''),
  lancCef('E', '7135', '26/01/2026', 'ENVIO PIX', -34, 0, '', '16082'),
  lancCef('E', '7136', '06/02/2026', 'DEV TR TED', 0.19, 0.19, '', ''),
  lancCef('A', '7137', '09/02/2026', 'DP DIN LOT', 1400, 1400.19, '', 'ITAMAR ALEXANDRE FELIX VILLA REAL JUNIOR x FRANCISCA ARAÚJO GOMES - 02/2026'),
  lancCef('E', '7138', '09/02/2026', 'ENVIO PIX', -1400.19, 0, '', '16081'),
  lancCef('A', '7139', '23/02/2026', 'CR LEV JUD', 5126.25, 5126.25, '', ''),
  lancCef('I', '7140', '25/02/2026', 'PREST HAB', -3065.45, 2060.8, '', ''),
  lancCef('E', '7141', '25/02/2026', 'CRED PIX', 3078, 5138.8, '', '16165'),
  lancCef('A', '7142', '25/02/2026', 'CR LEV JUD', 3202.43, 8341.23, '', ''),
  lancCef('E', '7143', '25/02/2026', 'ENVIO PIX', -8341.23, 0, '', '16166'),
  lancCef('A', '7144', '26/02/2026', 'CRED TED', 704.66, 704.66, '', ''),
  lancCef('E', '7145', '26/02/2026', 'ENVIO PIX', -704.66, 0, '', '16216'),
  lancCef('A', '7146', '02/03/2026', 'CR LEV JUD', 294.32, 294.32, '', ''),
  lancCef('E', '7147', '02/03/2026', 'ENVIO PIX', -294.32, 0, '', '16154'),
  lancCef('A', '7148', '09/03/2026', 'DP DIN LOT', 1400, 1400, '', ''),
  lancCef('E', '7149', '10/03/2026', 'ENVIO PIX', -1400, 0, '', ''),
];

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

/** CEF, Itaú, …, BTG Banking, BTG RACHEL, etc.; demais vazios. */
const MOCK_EXTRATOS_POR_BANCO = {
  ...Object.fromEntries(Object.keys(BANCO_TO_NUMERO).map((k) => [k, []])),
  CEF: cloneCefExtratoPdfMock(),
  Itaú: cloneItauExtratoXlsMock(),
  'Itaú Empresas': cloneItauEmpresasExtratoXlsMock(),
  CORA: cloneCoraExtratoXlsMock(),
  BB: cloneBbExtratoXlsMock(),
  Sicoob: cloneSicoobExtratoXlsMock(),
  'Sicoob VRV': cloneSicoobVrvExtratoXlsMock(),
  BTG: cloneBtgExtratoXlsMock(),
  'BTG Banking': cloneBtgBankingExtratoXlsMock(),
  'BTG JA': cloneBtgJaExtratoXlsMock(),
  'BTG RACHEL': cloneBtgRachelExtratoXlsMock(),
};

export const STORAGE_FINANCEIRO_EXTRATOS_KEY = 'vilareal.financeiro.extratos.v19';
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

function extratosTodosArraysVazios(obj) {
  const out = { ...obj };
  for (const k of Object.keys(out)) {
    if (Array.isArray(out[k])) out[k] = [];
  }
  return out;
}

function removerChavesExtratoLegadoFinanceiro() {
  try {
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
  if (!Array.isArray(d.CEF) || d.CEF.length === 0) d.CEF = cloneCefExtratoPdfMock();
  if (!Array.isArray(d['Itaú']) || d['Itaú'].length === 0) d['Itaú'] = cloneItauExtratoXlsMock();
  if (!Array.isArray(d.CORA) || d.CORA.length === 0) d.CORA = cloneCoraExtratoXlsMock();
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
  return d;
}

/**
 * Persistência v19. Inclui BB (mock XLS); migração a partir de v18.
 */
export function loadPersistedExtratosFinanceiro() {
  if (typeof window === 'undefined') return null;
  try {
    const raw19 = window.localStorage.getItem(STORAGE_FINANCEIRO_EXTRATOS_KEY);
    if (raw19) {
      const p = safeJsonParseFinanceiro(raw19);
      if (p?.data && typeof p.data === 'object' && p.v === 19) return p.data;
    }
    const tryMigrate = (raw, version) => {
      const parsed = safeJsonParseFinanceiro(raw);
      if (!parsed?.data || typeof parsed.data !== 'object' || parsed.v !== version) return null;
      const merged = { ...getExtratosIniciais(), ...parsed.data };
      return aplicarMocksInstituicoesVazias(merged);
    };
    const saveV19 = (out) => {
      window.localStorage.setItem(STORAGE_FINANCEIRO_EXTRATOS_KEY, JSON.stringify({ v: 19, data: out }));
      removerChavesExtratoLegadoFinanceiro();
    };
    const raw18ls = window.localStorage.getItem(STORAGE_FINANCEIRO_EXTRATOS_V18);
    if (raw18ls) {
      const out = tryMigrate(raw18ls, 18);
      if (out) {
        saveV19(out);
        return out;
      }
    }
    const raw17 = window.localStorage.getItem(STORAGE_FINANCEIRO_EXTRATOS_V17);
    if (raw17) {
      const out = tryMigrate(raw17, 17);
      if (out) {
        saveV19(out);
        return out;
      }
    }
    const raw16 = window.localStorage.getItem(STORAGE_FINANCEIRO_EXTRATOS_V16);
    if (raw16) {
      const out = tryMigrate(raw16, 16);
      if (out) {
        saveV19(out);
        return out;
      }
    }
    const raw15 = window.localStorage.getItem(STORAGE_FINANCEIRO_EXTRATOS_V15);
    if (raw15) {
      const out = tryMigrate(raw15, 15);
      if (out) {
        saveV19(out);
        return out;
      }
    }
    const raw14 = window.localStorage.getItem(STORAGE_FINANCEIRO_EXTRATOS_V14);
    if (raw14) {
      const out = tryMigrate(raw14, 14);
      if (out) {
        saveV19(out);
        return out;
      }
    }
    const raw13 = window.localStorage.getItem(STORAGE_FINANCEIRO_EXTRATOS_V13);
    if (raw13) {
      const out = tryMigrate(raw13, 13);
      if (out) {
        saveV19(out);
        return out;
      }
    }
    const raw12 = window.localStorage.getItem(STORAGE_FINANCEIRO_EXTRATOS_V12);
    if (raw12) {
      const out = tryMigrate(raw12, 12);
      if (out) {
        saveV19(out);
        return out;
      }
    }
    const raw11 = window.localStorage.getItem(STORAGE_FINANCEIRO_EXTRATOS_V11);
    if (raw11) {
      const out = tryMigrate(raw11, 11);
      if (out) {
        saveV19(out);
        return out;
      }
    }
    const raw10 = window.localStorage.getItem(STORAGE_FINANCEIRO_EXTRATOS_V10);
    if (raw10) {
      const out = tryMigrate(raw10, 10);
      if (out) {
        saveV19(out);
        return out;
      }
    }
    const raw9 = window.localStorage.getItem(STORAGE_FINANCEIRO_EXTRATOS_V9);
    if (raw9) {
      const out = tryMigrate(raw9, 9);
      if (out) {
        saveV19(out);
        return out;
      }
    }
    const raw8 = window.localStorage.getItem(STORAGE_FINANCEIRO_EXTRATOS_V8);
    if (raw8) {
      const out = tryMigrate(raw8, 8);
      if (out) {
        saveV19(out);
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
      limpo['Itaú'] = cloneItauExtratoXlsMock();
      limpo['Itaú Empresas'] = cloneItauEmpresasExtratoXlsMock();
      limpo.CORA = cloneCoraExtratoXlsMock();
      limpo.BB = cloneBbExtratoXlsMock();
      limpo.Sicoob = cloneSicoobExtratoXlsMock();
      limpo['Sicoob VRV'] = cloneSicoobVrvExtratoXlsMock();
      limpo.BTG = cloneBtgExtratoXlsMock();
      limpo['BTG Banking'] = cloneBtgBankingExtratoXlsMock();
      limpo['BTG JA'] = cloneBtgJaExtratoXlsMock();
      limpo['BTG RACHEL'] = cloneBtgRachelExtratoXlsMock();
      window.localStorage.setItem(
        STORAGE_FINANCEIRO_EXTRATOS_KEY,
        JSON.stringify({ v: 19, data: limpo })
      );
      removerChavesExtratoLegadoFinanceiro();
      return limpo;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function savePersistedExtratosFinanceiro(data) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_FINANCEIRO_EXTRATOS_KEY, JSON.stringify({ v: 19, data }));
    removerChavesExtratoLegadoFinanceiro();
  } catch {
    /* ignore */
  }
}

function cloneExtratos(extratos) {
  return JSON.parse(JSON.stringify(extratos));
}

/** Base: CEF + Itaú com mocks; demais vazios; depois pareamento interbancário. */
function getExtratosIniciais() {
  return parearCompensacaoInterbancaria(cloneExtratos(MOCK_EXTRATOS_POR_BANCO));
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

/** Pool de lançamentos elegíveis a compensação (mesma regra para detectar e aplicar). */
function montarPoolCompensacao(next) {
  const flat = [];
  for (const [nomeBanco, list] of Object.entries(next)) {
    list.forEach((t, idx) => {
      const c = centavos(t.valor);
      if (!t.data || c === null || c === 0) return;
      const procS = String(t.proc ?? '').trim();
      const orfaoCompensacao = t.letra === 'E' && procS.startsWith('?');
      const podeParear =
        t.letra === 'N' || (t.letra === 'E' && !procS) || orfaoCompensacao;
      if (!podeParear) return;
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
      const det = (x.t.descricaoDetalhada || '').trim();
      const tag = '[Par compensação]';
      if (!det.includes(tag)) {
        x.t.descricaoDetalhada = det ? `${det} ${tag}` : tag;
      }
    }
  }
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
export function somasPorParCompensacao(extratosPorBanco) {
  const txs = getTransacoesConsolidadas(extratosPorBanco, 'Conta Compensação');
  const grupos = {};
  for (const t of txs) {
    const pr = String(t.proc ?? '').trim() || '—';
    const c = centavos(t.valor);
    if (c === null) continue;
    grupos[pr] = (grupos[pr] || 0) + c;
  }
  return grupos;
}

/** Ordem estável das letras → contas (mesma ordem lógica do plano no app). */
const ORDEM_LETRA_CONTA = ['A', 'B', 'C', 'D', 'N', 'E', 'F', 'M', 'R', 'P', 'I', 'J'];

/**
 * Contas contábeis derivadas dos extratos: agrega por letra (conta) todos os bancos.
 * Ordena primeiro as contas com lançamentos (mais movimentadas primeiro), depois as sem uso.
 * @returns {Array<{ letra: string, nome: string, count: number, saldo: number }>}
 */
export function getContasContabeisDerivadasExtratos(extratosPorBanco) {
  const stats = {};
  for (const letra of ORDEM_LETRA_CONTA) {
    if (LETRA_TO_CONTA[letra]) stats[letra] = { count: 0, saldo: 0 };
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
  const items = ORDEM_LETRA_CONTA.filter((l) => LETRA_TO_CONTA[l]).map((letra) => ({
    letra,
    nome: LETRA_TO_CONTA[letra],
    count: stats[letra].count,
    saldo: stats[letra].saldo,
  }));
  items.sort((a, b) => {
    const ua = a.count > 0 ? 1 : 0;
    const ub = b.count > 0 ? 1 : 0;
    if (ua !== ub) return ub - ua;
    if (a.count !== b.count) return b.count - a.count;
    return ORDEM_LETRA_CONTA.indexOf(a.letra) - ORDEM_LETRA_CONTA.indexOf(b.letra);
  });
  return items;
}

function getTransacoesConsolidadas(extratosPorBanco, contaContabilNome) {
  const letra = CONTA_TO_LETRA[contaContabilNome];
  if (!letra) return [];
  const lista = [];
  for (const [nomeBanco, transacoes] of Object.entries(extratosPorBanco)) {
    for (const t of transacoes) {
      if (t.letra === letra) {
        lista.push({
          ...t,
          nomeBanco,
          numeroBanco: BANCO_TO_NUMERO[nomeBanco] ?? '-',
        });
      }
    }
  }
  return lista.sort((a, b) => a.data.localeCompare(b.data));
}

/** Normaliza código do cliente ou processo para comparação. Retorna '' se vazio ou não numérico. */
function normalizarCodigoCliente(val) {
  const s = String(val ?? '').trim();
  if (!s) return '';
  const n = Number(s);
  if (Number.isNaN(n) || n < 1) return '';
  return String(n);
}

/** Normaliza número de processo (1–100). Retorna '' se vazio ou não numérico. */
function normalizarProc(val) {
  const s = String(val ?? '').trim();
  if (!s) return '';
  const n = Number(s);
  if (Number.isNaN(n) || n < 1) return '';
  return String(n);
}

function lancamentoParaContaCorrenteModal(t) {
  return {
    data: t.data,
    descricao: t.descricao,
    dataOuId: t.proc,
    valor: t.valor,
    nome: (t.descricaoDetalhada || '').slice(0, 24) || '—',
    nomeBanco: t.nomeBanco,
    numero: t.numero,
  };
}

/**
 * Lançamentos da Conta Contábil "Conta Escritório" filtrados pelo código do cliente e processo em tela.
 * Usado na janela Conta Corrente em Processos.
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

export function getLancamentosContaCorrente(codigoCliente, processo) {
  const codigoNorm = normalizarCodigoCliente(codigoCliente);
  const procNorm = normalizarProc(processo);
  const extratos = getExtratosParaContaCorrente();
  const contaEscritorio = getTransacoesConsolidadas(extratos, 'Conta Escritório');

  let filtrado = codigoNorm
    ? contaEscritorio.filter((t) => normalizarCodigoCliente(t.codCliente) === codigoNorm)
    : [];
  if (procNorm) {
    filtrado = filtrado.filter((t) => normalizarProc(t.proc) === procNorm);
  }
  // Ordenação estável: data + número (quando existir)
  filtrado.sort((a, b) => {
    const byData = String(a.data ?? '').localeCompare(String(b.data ?? ''));
    if (byData !== 0) return byData;
    return Number(a.numero) - Number(b.numero);
  });
  const soma = filtrado.reduce((s, t) => s + t.valor, 0);
  const lancamentos = filtrado.map(lancamentoParaContaCorrenteModal);
  return { lancamentos, soma };
}

/**
 * Inclui na lista da Conta Corrente o lançamento vindo do duplo clique no consolidado (Financeiro),
 * se for Conta Escritório e bater cliente/processo, evitando duplicata (data + nº + banco).
 */
export function mergeContaCorrenteComLinhaOrigem(lancamentos, soma, linhaOrigem, codigoCliente, processo) {
  if (!linhaOrigem) return { lancamentos, soma };
  const letra = String(linhaOrigem.letra || 'A').toUpperCase();
  if (letra !== 'A') return { lancamentos, soma };
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
  getTransacoesConsolidadas,
};
