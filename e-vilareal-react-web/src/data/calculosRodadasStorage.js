/** Persistência das rodadas de Cálculos (parcelamento, títulos, etc.) — mesma chave usada na busca no Financeiro. */

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

export function saveRodadasCalculos(rodadas) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_CALCULOS_RODADAS_KEY, JSON.stringify(rodadas));
    window.dispatchEvent(new CustomEvent('vilareal:calculos-rodadas-atualizadas'));
  } catch {
    /* ignore quota */
  }
}
