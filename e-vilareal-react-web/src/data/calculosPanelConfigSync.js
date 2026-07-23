/**
 * Sincroniza panelConfig (juros, multa, honorários, índice…) entre dimensões da mesma rodada.
 */

import {
  extrairPanelConfig,
  CAMPOS_PANEL_CONFIG_CALCULO,
} from './calculosConfigDefaults.js';
import {
  loadRodadasCalculos,
  mapaRodadasTemValorTituloOuParcela,
  saveRodadasCalculos,
  splitRodadaCalculosKey,
} from './calculosRodadasStorage.js';

export { extrairPanelConfig, CAMPOS_PANEL_CONFIG_CALCULO } from './calculosConfigDefaults.js';

export function padCliente8Rodada(val) {
  const s = String(val ?? '').replace(/\D/g, '');
  const n = s ? Number(s) : 1;
  if (!Number.isFinite(n) || n < 1) return '00000001';
  return String(Math.floor(n)).padStart(8, '0');
}

function panelConfigsIguais(a, b) {
  const pa = extrairPanelConfig(a);
  const pb = extrairPanelConfig(b);
  return CAMPOS_PANEL_CONFIG_CALCULO.every((k) => String(pa[k] ?? '') === String(pb[k] ?? ''));
}

/**
 * Mescla {@code panelConfig} ao receber rodada da API: preserva edição local enquanto
 * difere do servidor (PUT pendente ou GET paginado desatualizado).
 * @param {Record<string, unknown> | null | undefined} panelConfigLocal
 * @param {Record<string, unknown> | null | undefined} panelConfigApi
 */
export function resolverPanelConfigAoMesclarRodadaApi(panelConfigLocal, panelConfigApi) {
  const localObj =
    panelConfigLocal != null && typeof panelConfigLocal === 'object' && !Array.isArray(panelConfigLocal)
      ? panelConfigLocal
      : null;
  const apiObj =
    panelConfigApi != null && typeof panelConfigApi === 'object' && !Array.isArray(panelConfigApi)
      ? panelConfigApi
      : null;
  if (!localObj) return apiObj ?? undefined;
  if (!apiObj) return localObj;
  if (panelConfigsIguais(localObj, apiObj)) return extrairPanelConfig(apiObj);
  return extrairPanelConfig(localObj);
}

export function chaveRodadaPertenceAoCliente(chave, codCliente) {
  const sp = splitRodadaCalculosKey(chave);
  if (!sp) return false;
  return sp.cod === padCliente8Rodada(codCliente);
}

export function chaveRodadaPertenceAoClienteProc(chave, codCliente, proc) {
  const sp = splitRodadaCalculosKey(chave);
  if (!sp) return false;
  const p = Number(proc);
  return sp.cod === padCliente8Rodada(codCliente) && sp.proc === p;
}

export function listarChavesRodadasCliente(rodadasMap, codCliente) {
  if (!rodadasMap || typeof rodadasMap !== 'object') return [];
  return Object.keys(rodadasMap).filter((k) => chaveRodadaPertenceAoCliente(k, codCliente));
}

export function listarChavesRodadasClienteProc(rodadasMap, codCliente, proc) {
  if (!rodadasMap || typeof rodadasMap !== 'object') return [];
  return Object.keys(rodadasMap).filter((k) => chaveRodadaPertenceAoClienteProc(k, codCliente, proc));
}

/**
 * @returns {{ nextMap: Record<string, unknown>, chavesAlteradas: string[] }}
 */
export function propagarPanelConfigEmRodadas(rodadasMap, chaves, panelConfig) {
  const panel = extrairPanelConfig(panelConfig);
  const nextMap = { ...(rodadasMap && typeof rodadasMap === 'object' ? rodadasMap : {}) };
  const chavesAlteradas = [];
  for (const chave of chaves) {
    const cur = nextMap[chave];
    if (!cur || typeof cur !== 'object') continue;
    if (panelConfigsIguais(cur.panelConfig ?? {}, panel)) continue;
    nextMap[chave] = { ...cur, panelConfig: panel };
    chavesAlteradas.push(chave);
  }
  return { nextMap, chavesAlteradas };
}

/** Após salvar config do cliente no cadastro, replica em todas as rodadas/dimensões. */
export function propagarConfigClienteNasRodadas(codCliente, configRow) {
  if (typeof window === 'undefined') return [];
  const rodadas = loadRodadasCalculos();
  const chaves = listarChavesRodadasCliente(rodadas, codCliente);
  if (chaves.length === 0) return [];
  const panel = extrairPanelConfig(configRow);
  const { nextMap, chavesAlteradas } = propagarPanelConfigEmRodadas(rodadas, chaves, panel);
  if (chavesAlteradas.length === 0) return [];
  const keysComValor = chavesAlteradas.filter((k) =>
    mapaRodadasTemValorTituloOuParcela({ [k]: nextMap[k] })
  );
  saveRodadasCalculos(nextMap, {
    persistRodadaKeysComValor: keysComValor.length > 0 ? keysComValor : chavesAlteradas,
  });
  return chavesAlteradas;
}
