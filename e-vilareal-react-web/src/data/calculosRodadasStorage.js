/** Persistência das rodadas de Cálculos (parcelamento, títulos, etc.) — mesma chave usada na busca no Financeiro. */

import { featureFlags } from '../config/featureFlags.js';
import { putCalculoRodadas, fetchCalculoRodadas } from '../repositories/calculosRepository.js';
import {
  enriquecerMapaRodadasTitulosDesdeParcelas,
  normalizarMapaChavesRodadasCalculos,
} from './calculosTitulosParcelasSync.js';
import { RODADAS_VINCULACAO_TESTE_50 } from './vinculacaoAutomaticaTestMock.js';

export const STORAGE_CALCULOS_RODADAS_KEY = 'vilareal.calculos.rodadas.v1';

const LOG_CALC_API = '[vilareal:calculos-api]';

/**
 * Com `VITE_USE_API_CALCULOS=true`, PUT só é permitido após o primeiro GET de hidratação concluir com sucesso.
 * Evita PUT com mapa parcial do localStorage antes do servidor preencher o storage (substituição total no backend).
 */
let __hidratacaoCalculosConcluida = !featureFlags.useApiCalculos;

export function isCalculosRodadasApiHidratacaoConcluida() {
  return __hidratacaoCalculosConcluida;
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

/**
 * Mescla rodada(s) de teste de vinculação automática (cliente 999 / proc 88) antes do que está no storage.
 * Assim o Financeiro vê "Aceitar Pagamento" e parcelas mesmo sem abrir Cálculos antes (load só lia localStorage vazio).
 * Dados salvos pelo usuário sobrescrevem a mesma chave, se existir.
 */
function mergeComRodadasTesteVinculacao(parsed) {
  const base = parsed && typeof parsed === 'object' ? parsed : {};
  return { ...RODADAS_VINCULACAO_TESTE_50, ...base };
}

export function loadRodadasCalculos() {
  if (typeof window === 'undefined') return mergeComRodadasTesteVinculacao(null);
  try {
    const s = window.localStorage.getItem(STORAGE_CALCULOS_RODADAS_KEY);
    if (!s) return mergeComRodadasTesteVinculacao(null);
    const parsed = JSON.parse(s);
    return mergeComRodadasTesteVinculacao(pipelineRodadasMap(parsed));
  } catch {
    return mergeComRodadasTesteVinculacao(null);
  }
}

/** @returns {boolean} true se gravou no localStorage */
let __rodadasApiSaveChain = Promise.resolve();

export function saveRodadasCalculos(rodadas) {
  if (typeof window === 'undefined') return false;
  try {
    const src = rodadas && typeof rodadas === 'object' && !Array.isArray(rodadas) ? { ...rodadas } : {};
    const prepared = pipelineRodadasMap(src);
    window.localStorage.setItem(STORAGE_CALCULOS_RODADAS_KEY, JSON.stringify(prepared));
    window.dispatchEvent(new CustomEvent('vilareal:calculos-rodadas-atualizadas'));
    if (featureFlags.useApiCalculos) {
      if (!__hidratacaoCalculosConcluida) {
        console.info(
          `${LOG_CALC_API} PUT bloqueado: hidratação da API ainda não concluída (aguardando GET /api/calculos/rodadas com sucesso).`
        );
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
          console.info(`${LOG_CALC_API} PUT permitido → agendando gravação na API.`);
          __rodadasApiSaveChain = __rodadasApiSaveChain
            .then(() => putCalculoRodadas(prepared))
            .catch((err) => {
              console.error('[vilareal] Falha ao gravar rodadas de cálculo na API:', err);
            });
        }
      }
    }
    return true;
  } catch {
    return false;
  }
}

function parseRodadasMapLocal() {
  if (typeof window === 'undefined') return {};
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
 * Sincroniza com o servidor: se o MySQL ainda não tiver rodadas e o navegador tiver dados, envia migração;
 * caso contrário, o servidor é a fonte da verdade e o localStorage é atualizado (o Financeiro continua lendo daqui).
 *
 * @param {{ preferServer?: boolean }} [options] — `preferServer: true` (ex.: botão «Sincronizar com banco»):
 *   nunca envia o localStorage para a API quando o servidor está vazio; só sobrescreve o local com o que veio do MySQL.
 */
export async function hydrateRodadasCalculosFromApi(options = {}) {
  if (typeof window === 'undefined' || !featureFlags.useApiCalculos) return;
  const preferServer = options.preferServer === true;
  __hidratacaoCalculosConcluida = false;
  window.dispatchEvent(new CustomEvent('vilareal:calculos-rodadas-api-hidratacao-iniciada'));
  try {
    console.info(`${LOG_CALC_API} GET /api/calculos/rodadas → em curso…`);
    const data = await fetchCalculoRodadas();
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
      window.localStorage.setItem(STORAGE_CALCULOS_RODADAS_KEY, JSON.stringify(toPush));
    } else {
      const merged = mergeComRodadasTesteVinculacao(pipelineRodadasMap(serverMap));
      window.localStorage.setItem(STORAGE_CALCULOS_RODADAS_KEY, JSON.stringify(merged));
    }
    __hidratacaoCalculosConcluida = true;
    window.dispatchEvent(new CustomEvent('vilareal:calculos-rodadas-atualizadas'));
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
  }
}
