/** Persistência das rodadas de Cálculos (parcelamento, títulos, etc.) — mesma chave usada na busca no Financeiro. */

import { featureFlags } from '../config/featureFlags.js';
import { putCalculoRodadas, fetchCalculoRodadas } from '../repositories/calculosRepository.js';
import { RODADAS_VINCULACAO_TESTE_50 } from './vinculacaoAutomaticaTestMock.js';

export const STORAGE_CALCULOS_RODADAS_KEY = 'vilareal.calculos.rodadas.v1';

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
    return mergeComRodadasTesteVinculacao(parsed);
  } catch {
    return mergeComRodadasTesteVinculacao(null);
  }
}

/** @returns {boolean} true se gravou no localStorage */
let __rodadasApiSaveChain = Promise.resolve();

export function saveRodadasCalculos(rodadas) {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(STORAGE_CALCULOS_RODADAS_KEY, JSON.stringify(rodadas));
    window.dispatchEvent(new CustomEvent('vilareal:calculos-rodadas-atualizadas'));
    if (featureFlags.useApiCalculos) {
      __rodadasApiSaveChain = __rodadasApiSaveChain
        .then(() => putCalculoRodadas(rodadas))
        .catch((err) => {
          console.error('[vilareal] Falha ao gravar rodadas de cálculo na API:', err);
        });
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
 */
export async function hydrateRodadasCalculosFromApi() {
  if (typeof window === 'undefined' || !featureFlags.useApiCalculos) return;
  try {
    const data = await fetchCalculoRodadas();
    const serverMap =
      data?.rodadas && typeof data.rodadas === 'object' && !Array.isArray(data.rodadas) ? data.rodadas : {};
    const localMap = parseRodadasMapLocal();
    const nServer = Object.keys(serverMap).length;
    const nLocal = Object.keys(localMap).length;

    if (nServer === 0 && nLocal > 0) {
      const toPush = mergeComRodadasTesteVinculacao(localMap);
      await putCalculoRodadas(toPush);
      window.localStorage.setItem(STORAGE_CALCULOS_RODADAS_KEY, JSON.stringify(toPush));
    } else {
      const merged = mergeComRodadasTesteVinculacao(serverMap);
      window.localStorage.setItem(STORAGE_CALCULOS_RODADAS_KEY, JSON.stringify(merged));
    }
    window.dispatchEvent(new CustomEvent('vilareal:calculos-rodadas-atualizadas'));
  } catch (err) {
    console.error('[vilareal] Falha ao hidratar rodadas de cálculo pela API:', err);
  }
}
