/**
 * Restaura o cenário de teste de vinculação automática (Financeiro × Cálculos):
 * lançamentos 88000–88049 sem classificação, rodada de teste nos Cálculos e log de consultas limpo.
 */

import { STORAGE_CALCULOS_RODADAS_KEY } from './calculosRodadasStorage.js';
import { clearConsultasVinculoLog } from './consultasVinculoHistoricoStorage.js';
import {
  BANCOS_VINCULACAO_TESTE,
  RODADA_KEY_VINCULACAO_TESTE,
  getExtratosVinculacaoTestePorBanco,
} from './vinculacaoAutomaticaTestMock.js';
import { loadPersistedExtratosFinanceiro, savePersistedExtratosFinanceiro } from './financeiroData.js';

/** Lançamentos gerados pelo mock de vinculação (50 parcelas / 50 extratos). */
export function isLancamentoVinculacaoTeste(t) {
  const n = parseInt(String(t?.numero ?? ''), 10);
  return Number.isFinite(n) && n >= 88000 && n <= 88049;
}

/**
 * Limpa o log de consultas de vínculo, remove a rodada de teste salva (volta ao merge padrão)
 * e substitui nos extratos persistidos os lançamentos 88000–88049 pelas cópias frescas do mock.
 * Recarregue a página (F5) para o Cálculos e o Financeiro refletirem tudo.
 * @returns {{ ok: boolean }}
 */
export function resetVinculacaoTesteCompleto() {
  if (typeof window === 'undefined') return { ok: false };
  clearConsultasVinculoLog();
  try {
    const s = window.localStorage.getItem(STORAGE_CALCULOS_RODADAS_KEY);
    const parsed = s ? JSON.parse(s) : {};
    if (parsed && typeof parsed === 'object') {
      delete parsed[RODADA_KEY_VINCULACAO_TESTE];
      window.localStorage.setItem(STORAGE_CALCULOS_RODADAS_KEY, JSON.stringify(parsed));
    }
  } catch {
    /* ignore */
  }
  const vincFresh = getExtratosVinculacaoTestePorBanco();
  const persisted = loadPersistedExtratosFinanceiro();
  if (persisted && typeof persisted === 'object') {
    const out = { ...persisted };
    for (const nome of BANCOS_VINCULACAO_TESTE) {
      const arr = Array.isArray(out[nome]) ? out[nome] : [];
      const kept = arr.filter((t) => !isLancamentoVinculacaoTeste(t));
      const fresh = vincFresh[nome] || [];
      out[nome] = [...kept, ...JSON.parse(JSON.stringify(fresh))];
    }
    savePersistedExtratosFinanceiro(out);
  }
  return { ok: true };
}
