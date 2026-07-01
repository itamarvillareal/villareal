/**
 * Configurações padrão de cálculo por cliente (Cadastro de Clientes).
 * Usadas na tela Cálculos quando não há personalização por processo (rodada).
 */

import { featureFlags } from '../config/featureFlags.js';
import { fetchCalculoConfigCliente, putCalculoConfigCliente } from '../repositories/calculosRepository.js';

export const STORAGE_CLIENTE_CONFIG_CALCULO = 'vilareal.cliente.configCalculo.v1';

export function padCliente8Config(val) {
  const s = String(val ?? '').replace(/\D/g, '');
  const n = s ? Number(s) : 1;
  if (!Number.isFinite(n) || n < 1) return '00000001';
  return String(Math.floor(n)).padStart(8, '0');
}

/** Valores alinhados ao legado e à tela Cálculos. */
export const DEFAULT_CONFIG_CALCULO_CLIENTE = {
  honorariosTipo: 'fixos',
  /** Percentual fixo (ex.: «20 %») — alinhado ao legado Excel / tela Cálculos */
  honorariosValor: '0 %',
  /** Texto livre para faixas (honorários variáveis), ex.: legado Excel */
  honorariosVariaveisTexto: '> 30 = 0%\n< 30 < 60 = 10%\n< 60 = 20%',
  juros: '1 %',
  multa: '0 %',
  indice: 'INPC',
  periodicidade: 'mensal',
  modeloListaDebitos: '01',
  /** 1 = importar tudo; 61 = 60+1 condicional */
  regraInicioCobrancaDias: 1,
};

function dispatchAtualizado() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vilareal:cliente-config-calculo-atualizado'));
  }
}

/** Honorários «fixos» são percentual (20 %), nunca valor em R$. */
export function normalizarHonorariosValorFixo(val) {
  const raw = String(val ?? '').trim();
  if (!raw) return '0 %';
  if (/%/.test(raw)) {
    const n = raw.replace(/%/g, '').trim().replace(',', '.');
    const num = Number(n);
    if (Number.isFinite(num)) {
      const fmt = Number.isInteger(num) ? String(num) : String(num).replace('.', ',');
      return `${fmt} %`;
    }
    return raw;
  }
  const semMoeda = raw.replace(/^R\$\s*/i, '').trim();
  const num = Number(semMoeda.replace(',', '.'));
  if (Number.isFinite(num)) {
    const fmt = Number.isInteger(num) ? String(num) : String(num).replace('.', ',');
    return `${fmt} %`;
  }
  return raw;
}

function normalizarRowConfigCalculo(row) {
  const out = { ...row };
  if (out.honorariosTipo !== 'variaveis') {
    out.honorariosValor = normalizarHonorariosValorFixo(out.honorariosValor);
  }
  return out;
}

/** Normaliza resposta `config` da API para o mesmo formato do bag em localStorage. */
function rowFromApiConfig(raw) {
  const base = { ...DEFAULT_CONFIG_CALCULO_CLIENTE };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const pick = (k) => {
    const v = raw[k];
    if (v === undefined || v === null) return;
    base[k] = typeof v === 'string' ? v : String(v);
  };
  pick('honorariosTipo');
  pick('honorariosValor');
  pick('honorariosVariaveisTexto');
  pick('juros');
  pick('multa');
  pick('indice');
  pick('periodicidade');
  pick('modeloListaDebitos');
  if (raw.regraInicioCobrancaDias !== undefined && raw.regraInicioCobrancaDias !== null) {
    const n = Number(raw.regraInicioCobrancaDias);
    if (n === 30 || n === 60) base.regraInicioCobrancaDias = 61;
    else if (n === 1 || n === 61) base.regraInicioCobrancaDias = n;
  }
  return normalizarRowConfigCalculo(base);
}

function gravarRowNoBag(key, row) {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(STORAGE_CLIENTE_CONFIG_CALCULO);
    const parsed = raw ? JSON.parse(raw) : {};
    const bag = parsed && typeof parsed === 'object' ? parsed : {};
    bag[key] = row;
    window.localStorage.setItem(STORAGE_CLIENTE_CONFIG_CALCULO, JSON.stringify(bag));
    dispatchAtualizado();
  } catch {
    /* quota */
  }
}

/** Atualiza o bag local a partir de `GET /api/calculos/config-cliente/{cod}`. */
export async function refreshConfigCalculoClienteFromApi(codCliente) {
  if (typeof window === 'undefined' || !featureFlags.useApiCalculos) return;
  const key = padCliente8Config(codCliente);
  try {
    const res = await fetchCalculoConfigCliente(key);
    gravarRowNoBag(key, rowFromApiConfig(res?.config));
  } catch (err) {
    console.error('[vilareal] Falha ao carregar config de cálculo na API:', err);
  }
}

/**
 * Configuração completa (defaults + o que foi salvo para o cliente).
 */
export function loadConfigCalculoCliente(codCliente) {
  const key = padCliente8Config(codCliente);
  const base = { ...DEFAULT_CONFIG_CALCULO_CLIENTE };
  if (typeof window === 'undefined') return base;
  try {
    const raw = window.localStorage.getItem(STORAGE_CLIENTE_CONFIG_CALCULO);
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return base;
    const row = parsed[key];
    if (!row || typeof row !== 'object') return base;
    return normalizarRowConfigCalculo({ ...base, ...row });
  } catch {
    return base;
  }
}

/**
 * @param {string} codCliente
 * @param {Partial<typeof DEFAULT_CONFIG_CALCULO_CLIENTE>} config
 */
export function saveConfigCalculoCliente(codCliente, config) {
  const key = padCliente8Config(codCliente);
  if (typeof window === 'undefined') return Promise.resolve();
  try {
    const raw = window.localStorage.getItem(STORAGE_CLIENTE_CONFIG_CALCULO);
    const parsed = raw ? JSON.parse(raw) : {};
    const bag = parsed && typeof parsed === 'object' ? parsed : {};
    const merged = {
      ...DEFAULT_CONFIG_CALCULO_CLIENTE,
      ...(bag[key] && typeof bag[key] === 'object' ? bag[key] : {}),
      ...config,
    };
    if (merged.honorariosTipo === 'variaveis') merged.honorariosValor = '';
    bag[key] = normalizarRowConfigCalculo(merged);
    window.localStorage.setItem(STORAGE_CLIENTE_CONFIG_CALCULO, JSON.stringify(bag));
    dispatchAtualizado();
    if (featureFlags.useApiCalculos) {
      return putCalculoConfigCliente(key, bag[key])
        .then((res) => {
          if (res?.config) gravarRowNoBag(key, rowFromApiConfig(res.config));
        })
        .catch((err) => {
          console.error('[vilareal] Falha ao gravar config de cálculo na API:', err);
          throw err;
        });
    }
    return Promise.resolve();
  } catch {
    /* quota */
    return Promise.resolve();
  }
}

/**
 * Mescla defaults do cliente com sobrescritas da rodada (processo/dimensão).
 */
export function mergeConfigPainelCalculo(defCliente, panelConfig) {
  const d = normalizarRowConfigCalculo({ ...DEFAULT_CONFIG_CALCULO_CLIENTE, ...defCliente });
  if (!panelConfig || typeof panelConfig !== 'object') return d;
  return normalizarRowConfigCalculo({ ...d, ...panelConfig });
}
