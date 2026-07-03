/**
 * Configurações padrão de cálculo por cliente (Cadastro de Clientes).
 * Usadas na tela Cálculos quando não há personalização por processo (rodada).
 */

import { featureFlags } from '../config/featureFlags.js';
import { fetchCalculoConfigCliente, putCalculoConfigCliente } from '../repositories/calculosRepository.js';
import {
  DEFAULT_CONFIG_CALCULO_CLIENTE,
  normalizarHonorariosValorFixo,
  normalizarRowConfigCalculo,
} from './calculosConfigDefaults.js';
import { propagarConfigClienteNasRodadas } from './calculosPanelConfigSync.js';

export {
  DEFAULT_CONFIG_CALCULO_CLIENTE,
  normalizarHonorariosValorFixo,
} from './calculosConfigDefaults.js';

export const STORAGE_CLIENTE_CONFIG_CALCULO = 'vilareal.cliente.configCalculo.v1';

export function padCliente8Config(val) {
  const s = String(val ?? '').replace(/\D/g, '');
  const n = s ? Number(s) : 1;
  if (!Number.isFinite(n) || n < 1) return '00000001';
  return String(Math.floor(n)).padStart(8, '0');
}

function dispatchAtualizado(detail) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('vilareal:cliente-config-calculo-atualizado', detail ? { detail } : undefined)
    );
  }
}

/** Valor exibido no campo de percentual fixo (sem « % » — símbolo fica fora do input). */
export function percentualFixoParaCampo(val) {
  return String(val ?? '')
    .replace(/%/g, '')
    .replace(/^R\$\s*/i, '')
    .trim();
}

/** Normaliza texto digitado no campo de percentual fixo enquanto o usuário digita. */
export function editarPercentualFixoCampo(texto) {
  let t = String(texto ?? '')
    .replace(/%/g, '')
    .replace(/^R\$\s*/i, '')
    .trim();
  if (!t) return '';
  t = t.replace(/[^\d.,]/g, '');
  const sepIndex = t.search(/[.,]/);
  if (sepIndex < 0) return t;
  const intPart = t.slice(0, sepIndex).replace(/[.,]/g, '');
  const decPart = t.slice(sepIndex + 1).replace(/[.,]/g, '').slice(0, 4);
  if (t.endsWith(',') || t.endsWith('.')) {
    return `${intPart},`;
  }
  return decPart.length > 0 ? `${intPart},${decPart}` : intPart;
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
    const chavesRodadas = propagarConfigClienteNasRodadas(key, bag[key]);
    dispatchAtualizado({ codCliente: key, chavesRodadas });
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
