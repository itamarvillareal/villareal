import { featureFlags } from '../../../config/featureFlags.js';
import {
  getExtratosIniciais,
  limparExtratoBancoEElosRelacionados,
  loadPersistedExtratosFinanceiro,
  savePersistedExtratosFinanceiro,
} from '../../../data/financeiroData.js';
import {
  limparExtratoBancoFinanceiroApi,
  limparExtratoCartaoFinanceiroApi,
} from '../../../repositories/financeiroRepository.js';
import { EVENT_FINANCEIRO_PERSISTENCIA_EXTERNA } from '../../../services/crossTabLocalStorageSync.js';
import { dispatchRefreshPendentes } from '../hooks/useKeyboardShortcuts.js';

export const FINANCEIRO_CONTA_LIMPA = 'financeiro:conta-limpa';

export function dispatchContaLimpa(detail = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(FINANCEIRO_CONTA_LIMPA, { detail }));
}

function limparExtratoLocalBanco(nomeBanco) {
  const merged = {
    ...getExtratosIniciais(),
    ...(loadPersistedExtratosFinanceiro() || {}),
  };
  const cleaned = limparExtratoBancoEElosRelacionados(merged, nomeBanco);
  savePersistedExtratosFinanceiro(cleaned);
}

function notificarPersistenciaExterna() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENT_FINANCEIRO_PERSISTENCIA_EXTERNA));
}

/**
 * Apaga todos os lançamentos de uma conta corrente (API + cópia local legada).
 * @returns {Promise<{ removidos: number, desvinculados: number }>}
 */
export async function limparContaCorrenteFinanceiro({ nomeBanco, numeroBanco }) {
  const nome = String(nomeBanco ?? '').trim();
  if (!nome) {
    throw new Error('Selecione uma conta corrente.');
  }
  const nb =
    numeroBanco != null && Number.isFinite(Number(numeroBanco)) ? Number(numeroBanco) : undefined;

  let removidos = 0;
  let desvinculados = 0;

  if (featureFlags.useApiFinanceiro) {
    const r = await limparExtratoBancoFinanceiroApi(nome, nb);
    removidos = Number(r?.lancamentosRemovidos) || 0;
    desvinculados = Number(r?.lancamentosDesvinculadosOutrosBancos) || 0;
  }

  limparExtratoLocalBanco(nome);
  dispatchRefreshPendentes();
  dispatchContaLimpa({ tipo: 'banco', nomeBanco: nome, numeroBanco: nb });
  notificarPersistenciaExterna();

  return { removidos, desvinculados };
}

/**
 * Apaga todos os lançamentos de um cartão (API).
 * @returns {Promise<{ removidos: number }>}
 */
export async function limparCartaoFinanceiro({ nomeCartao, numeroCartao }) {
  const nome = String(nomeCartao ?? '').trim();
  if (!nome) {
    throw new Error('Selecione um cartão.');
  }
  const nc =
    numeroCartao != null && Number.isFinite(Number(numeroCartao)) ? Number(numeroCartao) : undefined;

  let removidos = 0;

  if (featureFlags.useApiFinanceiro) {
    const r = await limparExtratoCartaoFinanceiroApi(nome, nc);
    removidos = Number(r?.lancamentosRemovidos) || 0;
  }

  dispatchRefreshPendentes();
  dispatchContaLimpa({ tipo: 'cartao', nomeCartao: nome, numeroCartao: nc });
  notificarPersistenciaExterna();

  return { removidos };
}
