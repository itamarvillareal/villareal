/** Persistência das rodadas de Cálculos (parcelamento, títulos, etc.) — mesma chave usada na busca no Financeiro. */

import { featureFlags } from '../config/featureFlags.js';
import {
  putCalculoRodadas,
  fetchCalculoRodadas,
  fetchCalculoRodadasResumo,
  putCalculoRodada,
} from '../repositories/calculosRepository.js';
import {
  enriquecerMapaRodadasTitulosDesdeParcelas,
  normalizarMapaChavesRodadasCalculos,
} from './calculosTitulosParcelasSync.js';
import { RODADAS_VINCULACAO_TESTE_50 } from './vinculacaoAutomaticaTestMock.js';

export const STORAGE_CALCULOS_RODADAS_KEY = 'vilareal.calculos.rodadas.v1';

const LOG_CALC_API = '[vilareal:calculos-api]';
const LRU_MAX = 20;

/**
 * Com `VITE_USE_API_CALCULOS=true`, payloads completos ficam num LRU (evita RAM com milhares de rodadas).
 * Metadados `parcelamentoAceito` de todas as chaves vêm de GET `/rodadas/resumo` ou de sync admin.
 */
const __rodadasPayloadLru = new Map();

/** `chave` → parcelamentoAceito (alinhado ao GET `/rodadas/resumo`). */
const __resumoParcelamentoAceito = new Map();

/**
 * Após «Sincronizar com banco» (GET mapa completo), expõe todas as rodadas em `loadRodadasCalculos` até o próximo resumo-only.
 * @type {Record<string, unknown> | null}
 */
let __fullRodadasMapPosAdminSync = null;

/**
 * Com `VITE_USE_API_CALCULOS=true`, PUT individual só após resumo (ou sync admin) marcar API pronta.
 */
let __hidratacaoCalculosConcluida = !featureFlags.useApiCalculos;

function lruSet(key, val) {
  if (__rodadasPayloadLru.has(key)) __rodadasPayloadLru.delete(key);
  __rodadasPayloadLru.set(key, val);
  while (__rodadasPayloadLru.size > LRU_MAX) {
    const first = __rodadasPayloadLru.keys().next().value;
    __rodadasPayloadLru.delete(first);
  }
}

function lruToObject() {
  return Object.fromEntries(__rodadasPayloadLru);
}

function rebuildResumoFromFullRodadasMap(map) {
  __resumoParcelamentoAceito.clear();
  const m = map && typeof map === 'object' && !Array.isArray(map) ? map : {};
  for (const [chave, rodada] of Object.entries(m)) {
    if (!chave) continue;
    __resumoParcelamentoAceito.set(chave, Boolean(rodada?.parcelamentoAceito));
  }
}

/** @returns {{ cod: string, proc: number, dim: number } | null} */
export function splitRodadaCalculosKey(chave) {
  const parts = String(chave ?? '').split(':');
  if (parts.length < 3) return null;
  const dim = Number(parts.pop());
  const proc = Number(parts.pop());
  const cod = parts.join(':');
  if (!/^\d{8}$/.test(cod) || !Number.isFinite(proc) || !Number.isFinite(dim)) return null;
  return { cod, proc, dim };
}

export function isCalculosRodadasApiHidratacaoConcluida() {
  return __hidratacaoCalculosConcluida;
}

/** Contagem global de rodadas com parcelamento aceite (GET resumo ou sync admin). */
export function countRodadasParcelamentoAceitoResumo() {
  let n = 0;
  for (const v of __resumoParcelamentoAceito.values()) {
    if (v) n += 1;
  }
  return n;
}

function campoValorNaoVazio(s) {
  return String(s ?? '').trim() !== '';
}

/**
 * True se alguma rodada tiver valor monetário (ou texto de valor) em título ou parcela.
 * Usado para não enviar PUT /api/calculos/rodadas com só templates vazios (autosave antes da hidratação apagava o MySQL).
 */
export function mapaRodadasTemValorTituloOuParcela(map) {
  if (!map || typeof map !== 'object' || Array.isArray(map)) return false;
  for (const rodada of Object.values(map)) {
    if (!rodada || typeof rodada !== 'object') continue;
    const titulos = Array.isArray(rodada.titulos) ? rodada.titulos : [];
    for (const t of titulos) {
      if (t && (campoValorNaoVazio(t.valorInicial) || campoValorNaoVazio(t.valorParcela))) return true;
    }
    const parcelas = Array.isArray(rodada.parcelas) ? rodada.parcelas : [];
    for (const p of parcelas) {
      if (p && campoValorNaoVazio(p.valorParcela)) return true;
    }
  }
  return false;
}

/** Chaves 8 dígitos + espelho parcelas→titulos (registos legados / SQL). */
function pipelineRodadasMap(raw) {
  const m = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return enriquecerMapaRodadasTitulosDesdeParcelas(normalizarMapaChavesRodadasCalculos(m));
}

/** Normaliza uma rodada recebida do GET individual e atualiza o LRU. */
export function normalizarRodadaRecebidaApi(chave, raw) {
  if (!chave || !raw || typeof raw !== 'object') return null;
  const m = pipelineRodadasMap({ [chave]: raw });
  const one = m[chave];
  if (one && typeof one === 'object') lruSet(chave, one);
  return one ?? null;
}

/**
 * Mescla rodada(s) de teste de vinculação automática (cliente 999 / proc 88) antes do que está no storage.
 * Assim o Financeiro vê "Aceitar Pagamento" e parcelas mesmo sem abrir Cálculos antes (load só lia localStorage vazio).
 * Dados salvos pelo usuário sobrescrevem a mesma chave, se existir.
 */
function mergeComRodadasTesteVinculacao(parsed) {
  const base = parsed && typeof parsed === 'object' ? parsed : {};
  return { ...RODADAS_VINCULACAO_TESTE_50, ...base };
}

function buildApiCalculosReadMap() {
  if (__fullRodadasMapPosAdminSync && typeof __fullRodadasMapPosAdminSync === 'object') {
    return __fullRodadasMapPosAdminSync;
  }
  const fromLru = lruToObject();
  const stubs = {};
  for (const [chave, aceito] of __resumoParcelamentoAceito) {
    if (fromLru[chave] == null) {
      stubs[chave] = {
        parcelamentoAceito: aceito,
        pagina: 1,
        paginaParcelamento: 1,
        titulos: [],
        parcelas: [],
        quantidadeParcelasInformada: '00',
        taxaJurosParcelamento: '0,00',
        limpezaAtiva: false,
        snapshotAntesLimpeza: null,
        cabecalho: { autor: '', reu: '' },
        honorariosDataRecebimento: {},
        panelConfig: null,
      };
    }
  }
  return { ...stubs, ...fromLru };
}

export function loadRodadasCalculos() {
  if (typeof window === 'undefined') return mergeComRodadasTesteVinculacao(null);
  if (featureFlags.useApiCalculos) {
    const raw = buildApiCalculosReadMap();
    return mergeComRodadasTesteVinculacao(pipelineRodadasMap(raw));
  }
  try {
    const s = window.localStorage.getItem(STORAGE_CALCULOS_RODADAS_KEY);
    if (!s) return mergeComRodadasTesteVinculacao(null);
    const parsed = JSON.parse(s);
    return mergeComRodadasTesteVinculacao(pipelineRodadasMap(parsed));
  } catch {
    return mergeComRodadasTesteVinculacao(null);
  }
}

/** @returns {boolean} true se persistiu (localStorage ou espelho em memória + eventual PUT na API) */
let __rodadasApiSaveChain = Promise.resolve();

function emitRodadasAtualizadas(detail) {
  window.dispatchEvent(
    new CustomEvent('vilareal:calculos-rodadas-atualizadas', detail ? { detail } : undefined)
  );
}

/**
 * @param {Record<string, unknown>} rodadas
 * @param {{ persistRodadaKey?: string, persistRodadaKeysComValor?: string[] }} [options]
 */
export function saveRodadasCalculos(rodadas, options = {}) {
  if (typeof window === 'undefined') return false;
  const persistRodadaKey = options.persistRodadaKey;
  const persistRodadaKeysComValor = options.persistRodadaKeysComValor;
  try {
    const src = rodadas && typeof rodadas === 'object' && !Array.isArray(rodadas) ? { ...rodadas } : {};
    const prepared = pipelineRodadasMap(src);
    if (featureFlags.useApiCalculos) {
      if (typeof persistRodadaKey === 'string' && persistRodadaKey) {
        const one = prepared[persistRodadaKey];
        if (one && typeof one === 'object') lruSet(persistRodadaKey, one);
      } else if (Array.isArray(persistRodadaKeysComValor)) {
        for (const k of persistRodadaKeysComValor) {
          const one = prepared[k];
          if (one && typeof one === 'object') lruSet(k, one);
        }
      }
      if (!__hidratacaoCalculosConcluida) {
        console.info(
          `${LOG_CALC_API} PUT bloqueado: hidratação da API ainda não concluída (aguardando GET /api/calculos/rodadas/resumo com sucesso).`
        );
      } else {
        const chainPut = (chave) => {
          const payload = prepared[chave];
          if (!payload || typeof payload !== 'object') return Promise.resolve();
          const sp = splitRodadaCalculosKey(chave);
          if (!sp) return Promise.resolve();
          const slice = { [chave]: payload };
          if (!mapaRodadasTemValorTituloOuParcela(slice)) return Promise.resolve();
          return putCalculoRodada(sp.cod, sp.proc, sp.dim, payload).then((saved) => {
            if (saved && typeof saved === 'object') {
              lruSet(chave, saved);
              __resumoParcelamentoAceito.set(chave, Boolean(saved.parcelamentoAceito));
            }
          });
        };

        if (typeof persistRodadaKey === 'string' && persistRodadaKey) {
          const slice = { [persistRodadaKey]: prepared[persistRodadaKey] };
          const ok = mapaRodadasTemValorTituloOuParcela(slice);
          console.info(`${LOG_CALC_API} PUT individual → ${persistRodadaKey} (temValor=${ok})`);
          if (!ok) {
            console.info(
              `${LOG_CALC_API} PUT bloqueado: rodada atual sem valorInicial/valorParcela em títulos ou parcelas.`
            );
          } else {
            emitRodadasAtualizadas();
            __rodadasApiSaveChain = __rodadasApiSaveChain
              .then(() => chainPut(persistRodadaKey))
              .catch((err) => {
                console.error('[vilareal] Falha ao gravar rodada de cálculo na API:', err);
              });
          }
        } else if (Array.isArray(persistRodadaKeysComValor) && persistRodadaKeysComValor.length > 0) {
          console.info(
            `${LOG_CALC_API} PUT individual (lote importação) → ${persistRodadaKeysComValor.length} chave(s)`
          );
          emitRodadasAtualizadas();
          __rodadasApiSaveChain = persistRodadaKeysComValor.reduce(
            (p, chave) => p.then(() => chainPut(chave)),
            __rodadasApiSaveChain
          );
          __rodadasApiSaveChain = __rodadasApiSaveChain.catch((err) => {
            console.error('[vilareal] Falha ao gravar rodadas de cálculo na API (importação):', err);
          });
        } else {
          const mapaTemValor = mapaRodadasTemValorTituloOuParcela(prepared);
          console.info(
            `${LOG_CALC_API} mapaRodadasTemValorTituloOuParcela=${mapaTemValor} (chaves no mapa: ${Object.keys(prepared).length})`
          );
          if (!mapaTemValor) {
            console.info(
              `${LOG_CALC_API} PUT bloqueado: mapa sem valorInicial/valorParcela em títulos ou parcelas.`
            );
          } else {
            console.info(`${LOG_CALC_API} PUT global (admin/migração) → agendando gravação na API.`);
            __rodadasApiSaveChain = __rodadasApiSaveChain
              .then(() => putCalculoRodadas(prepared))
              .then(() => {
                rebuildResumoFromFullRodadasMap(prepared);
                emitRodadasAtualizadas({
                  rodadas: mergeComRodadasTesteVinculacao(pipelineRodadasMap(prepared)),
                  mapaCompleto: true,
                });
              })
              .catch((err) => {
                console.error('[vilareal] Falha ao gravar rodadas de cálculo na API:', err);
              });
          }
        }
      }
      return true;
    }
    window.localStorage.setItem(STORAGE_CALCULOS_RODADAS_KEY, JSON.stringify(prepared));
    emitRodadasAtualizadas();
    return true;
  } catch {
    return false;
  }
}

function parseRodadasMapLocal() {
  if (typeof window === 'undefined') return {};
  if (featureFlags.useApiCalculos) return {};
  try {
    const s = window.localStorage.getItem(STORAGE_CALCULOS_RODADAS_KEY);
    if (!s) return {};
    const parsed = JSON.parse(s);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Hidratação leve: só GET `/rodadas/resumo` (metadados). Fluxo normal do Layout.
 */
export async function hydrateRodadasCalculosResumoFromApi(options = {}) {
  if (typeof window === 'undefined' || !featureFlags.useApiCalculos) return;
  const silent = options.silent === true;
  if (!silent) {
    __hidratacaoCalculosConcluida = false;
    window.dispatchEvent(new CustomEvent('vilareal:calculos-rodadas-api-hidratacao-iniciada'));
  }
  const root = document.documentElement;
  const cursorAntes = root.style.cursor;
  if (!silent) root.style.cursor = 'wait';
  try {
    __fullRodadasMapPosAdminSync = null;
    console.info(`${LOG_CALC_API} GET /api/calculos/rodadas/resumo → em curso…`);
    const data = await fetchCalculoRodadasResumo();
    __resumoParcelamentoAceito.clear();
    const rows = Array.isArray(data?.rodadas) ? data.rodadas : [];
    for (const row of rows) {
      if (row?.chave) __resumoParcelamentoAceito.set(String(row.chave), Boolean(row.parcelamentoAceito));
    }
    console.info(`${LOG_CALC_API} GET /api/calculos/rodadas/resumo → OK, entradas: ${rows.length}`);
    __hidratacaoCalculosConcluida = true;
    emitRodadasAtualizadas();
    window.dispatchEvent(
      new CustomEvent('vilareal:calculos-rodadas-api-hidratacao-concluida', {
        detail: { ok: true, nRodadas: rows.length, modo: 'resumo' },
      })
    );
  } catch (err) {
    console.error('[vilareal] Falha ao hidratar resumo de rodadas pela API:', err);
    __hidratacaoCalculosConcluida = false;
    window.dispatchEvent(
      new CustomEvent('vilareal:calculos-rodadas-api-hidratacao-concluida', {
        detail: { ok: false, nRodadas: 0, erro: String(err?.message || err) },
      })
    );
  } finally {
    if (!silent) root.style.cursor = cursorAntes;
  }
}

/**
 * Sincroniza com o servidor: se o MySQL ainda não tiver rodadas e o navegador tiver dados, envia migração;
 * caso contrário, o servidor é a fonte da verdade e o espelho em memória + evento atualizam o restante da app (sem localStorage quando a API está ativa).
 *
 * @param {{ preferServer?: boolean }} [options] — `preferServer: true` (ex.: botão «Sincronizar com banco»):
 *   nunca envia o localStorage para a API quando o servidor está vazio; só sobrescreve o local com o que veio do MySQL.
 */
export async function hydrateRodadasCalculosFromApi(options = {}) {
  if (typeof window === 'undefined' || !featureFlags.useApiCalculos) return;
  const preferServer = options.preferServer === true;
  __hidratacaoCalculosConcluida = false;
  window.dispatchEvent(new CustomEvent('vilareal:calculos-rodadas-api-hidratacao-iniciada'));
  const root = document.documentElement;
  const cursorAntes = root.style.cursor;
  root.style.cursor = 'wait';
  try {
    console.info(`${LOG_CALC_API} GET /api/calculos/rodadas → em curso…`);
    const data = await fetchCalculoRodadas({});
    const serverMap =
      data?.rodadas && typeof data.rodadas === 'object' && !Array.isArray(data.rodadas) ? data.rodadas : {};
    const nRodadas = Object.keys(serverMap).length;
    console.info(`${LOG_CALC_API} GET /api/calculos/rodadas → OK, chaves em rodadas: ${nRodadas}`);
    const localMap = parseRodadasMapLocal();
    const nServer = Object.keys(serverMap).length;
    const nLocal = Object.keys(localMap).length;

    if (nServer === 0 && nLocal > 0 && !preferServer) {
      const toPush = mergeComRodadasTesteVinculacao(pipelineRodadasMap(localMap));
      const mapaTemValor = mapaRodadasTemValorTituloOuParcela(toPush);
      console.info(
        `${LOG_CALC_API} Servidor vazio + local com dados: mapaRodadasTemValorTituloOuParcela=${mapaTemValor} (migração local→API).`
      );
      if (mapaTemValor) {
        console.info(`${LOG_CALC_API} PUT migração permitido (primeira carga com dados locais).`);
        await putCalculoRodadas(toPush);
      } else {
        console.info(`${LOG_CALC_API} PUT migração não enviado (mapa só templates vazios).`);
      }
      rebuildResumoFromFullRodadasMap(toPush);
      __fullRodadasMapPosAdminSync = null;
      for (const [k, v] of Object.entries(toPush)) {
        if (v && typeof v === 'object') lruSet(k, v);
      }
    } else {
      const merged = mergeComRodadasTesteVinculacao(pipelineRodadasMap(serverMap));
      rebuildResumoFromFullRodadasMap(merged);
      if (preferServer) {
        __fullRodadasMapPosAdminSync = merged;
      } else {
        __fullRodadasMapPosAdminSync = null;
        for (const [k, v] of Object.entries(merged)) {
          if (v && typeof v === 'object') lruSet(k, v);
        }
      }
    }
    __hidratacaoCalculosConcluida = true;
    const rodadasParaUi = mergeComRodadasTesteVinculacao(pipelineRodadasMap(buildApiCalculosReadMap()));
    emitRodadasAtualizadas({ rodadas: rodadasParaUi, mapaCompleto: true });
    window.dispatchEvent(
      new CustomEvent('vilareal:calculos-rodadas-api-hidratacao-concluida', {
        detail: { ok: true, nRodadas },
      })
    );
  } catch (err) {
    console.error('[vilareal] Falha ao hidratar rodadas de cálculo pela API:', err);
    __hidratacaoCalculosConcluida = false;
    window.dispatchEvent(
      new CustomEvent('vilareal:calculos-rodadas-api-hidratacao-concluida', {
        detail: { ok: false, nRodadas: 0, erro: String(err?.message || err) },
      })
    );
  } finally {
    root.style.cursor = cursorAntes;
  }
}
