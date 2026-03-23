import { featureFlags } from '../config/featureFlags.js';
import { loadPersistedExtratosFinanceiro } from '../data/financeiroData.js';
import {
  listarLancamentosFinanceiro,
  salvarOuAtualizarLancamentoFinanceiroApi,
} from '../repositories/financeiroRepository.js';
import { buscarClientePorCodigo, buscarProcessoPorChaveNatural } from '../repositories/processosRepository.js';

const IMPORT_DONE_KEY = 'vilareal:migration:phase5-financeiro:done:v1';
const STORAGE_READ_KEYS_PHASE5 = ['vilareal.financeiro.extratos.v20', 'vilareal.financeiro.extratos.v19'];

export const LOCALSTORAGE_KEYS_PHASE5_FINANCEIRO = STORAGE_READ_KEYS_PHASE5;

function limpar(v) {
  return String(v ?? '').trim().toLowerCase();
}

function chaveDedupe(item) {
  return [
    limpar(item.dataLancamento || item.data),
    String(Number(item.valor ?? 0).toFixed(2)),
    limpar(item.descricao),
    limpar(item.contaContabilNome || item.contaNome || item.letra),
    String(item.clienteId ?? ''),
    String(item.processoId ?? ''),
    limpar(item.numeroLancamento || item.numero),
  ].join('|');
}

function coletarLancamentosLegado(extratos) {
  const out = [];
  for (const [nomeBanco, lista] of Object.entries(extratos || {})) {
    if (!Array.isArray(lista)) continue;
    for (const t of lista) {
      out.push({ ...t, nomeBanco });
    }
  }
  return out;
}

function getMarcadorImportacao() {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(IMPORT_DONE_KEY) === '1';
}

export function getStatusMigracaoAssistidaPhase5Financeiro() {
  return {
    habilitadaPorFlag: Boolean(featureFlags.enableLocalStorageImportPhase5Financeiro),
    apiFinanceiroAtiva: Boolean(featureFlags.useApiFinanceiro),
    jaExecutada: getMarcadorImportacao(),
    markerKey: IMPORT_DONE_KEY,
    storageKeysLidas: [...STORAGE_READ_KEYS_PHASE5],
  };
}

export async function previsualizarMigracaoAssistidaPhase5Financeiro() {
  const status = getStatusMigracaoAssistidaPhase5Financeiro();
  const extratos = loadPersistedExtratosFinanceiro();
  const rows = coletarLancamentosLegado(extratos || {});
  if (!status.habilitadaPorFlag || !status.apiFinanceiroAtiva) {
    return {
      ...status,
      totalLegado: rows.length,
      importavelEstimado: 0,
      duplicadoEstimado: 0,
      semVinculoEstimado: 0,
      observacao:
        'Prévia limitada: ative VITE_ENABLE_LOCALSTORAGE_IMPORT_PHASE5_FINANCEIRO=true e VITE_USE_API_FINANCEIRO=true.',
    };
  }
  const remoto = await listarLancamentosFinanceiro();
  const dedupe = new Set((remoto || []).map((r) => chaveDedupe(r)));
  let duplicadoEstimado = 0;
  let semVinculoEstimado = 0;
  for (const row of rows) {
    if (dedupe.has(chaveDedupe(row))) duplicadoEstimado += 1;
    const codClienteTexto = String(row.codCliente ?? '').trim();
    const procTexto = String(row.proc ?? '').trim();
    if ((codClienteTexto || procTexto) && !/^\d+$/.test(codClienteTexto) && !/^\d+$/.test(procTexto)) {
      semVinculoEstimado += 1;
    }
  }
  return {
    ...status,
    totalLegado: rows.length,
    importavelEstimado: Math.max(0, rows.length - duplicadoEstimado),
    duplicadoEstimado,
    semVinculoEstimado,
    observacao:
      'Duplicados são estimados por chave composta; sem vínculo é estimativa textual. O valor final só é conhecido após execução.',
  };
}

export async function executarMigracaoAssistidaPhase5Financeiro() {
  if (typeof window === 'undefined') return null;
  if (getMarcadorImportacao()) return null;
  if (!featureFlags.enableLocalStorageImportPhase5Financeiro) return null;
  if (!featureFlags.useApiFinanceiro) return null;

  const extratos = loadPersistedExtratosFinanceiro();
  if (!extratos || typeof extratos !== 'object') return null;

  const remoto = await listarLancamentosFinanceiro();
  const dedupe = new Set((remoto || []).map((r) => chaveDedupe(r)));
  const rows = coletarLancamentosLegado(extratos);

  let importados = 0;
  let ignorados = 0;
  let semVinculo = 0;

  for (const row of rows) {
    const dedupeKey = chaveDedupe(row);
    if (dedupe.has(dedupeKey)) {
      ignorados += 1;
      continue;
    }
    const codClienteTexto = String(row.codCliente ?? '').trim();
    const procTexto = String(row.proc ?? '').trim();
    let clienteId = null;
    let processoId = null;

    if (codClienteTexto) {
      const cliente = await buscarClientePorCodigo(codClienteTexto.padStart(8, '0'));
      clienteId = cliente?.id ?? null;
    }
    if (codClienteTexto && procTexto) {
      const processo = await buscarProcessoPorChaveNatural(codClienteTexto.padStart(8, '0'), Number(procTexto));
      processoId = processo?.id ?? null;
    }
    if ((codClienteTexto || procTexto) && !clienteId && !processoId) semVinculo += 1;

    const saved = await salvarOuAtualizarLancamentoFinanceiroApi({
      ...row,
      _financeiroMeta: {
        ...(row._financeiroMeta || {}),
        clienteId,
        processoId,
      },
    });
    if (saved?.id) {
      dedupe.add(chaveDedupe(saved));
      importados += 1;
    } else {
      ignorados += 1;
    }
  }

  window.localStorage.setItem(IMPORT_DONE_KEY, '1');
  return { importados, ignorados, semVinculo, totalLidos: rows.length };
}
