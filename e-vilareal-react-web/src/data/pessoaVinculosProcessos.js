/**
 * Vínculos pessoa → processos: API (`/api/processos/vinculo-pessoa/{id}`) + histórico local.
 */

import { featureFlags } from '../config/featureFlags.js';
import { listarProcessosPorIdPessoa } from './processosHistoricoData.js';
import { listarProcessosVinculoPessoaDiagnostico } from '../repositories/processosRepository.js';

function padCliente8(cod) {
  const d = String(cod ?? '1').replace(/\D/g, '') || '1';
  const n = Math.max(1, Math.floor(Number(d)) || 1);
  return String(n).padStart(8, '0');
}

function chaveItemVinculoPessoa(item) {
  const cod8 = padCliente8(item.codCliente ?? item.codigoCliente);
  const pr = Math.floor(Number(String(item.proc ?? item.numeroInterno ?? '').replace(/\D/g, '')) || 0);
  return `${cod8}-${pr}`;
}

/** API primeiro; entradas só no histórico local completam sem duplicar por código+proc. */
export function mergeProcessosVinculoPessoa(apiItens, locais) {
  const m = new Map();
  for (const x of apiItens || []) m.set(chaveItemVinculoPessoa(x), x);
  for (const x of locais || []) {
    const k = chaveItemVinculoPessoa(x);
    if (!m.has(k)) m.set(k, x);
  }
  return [...m.values()].sort((a, b) => chaveItemVinculoPessoa(a).localeCompare(chaveItemVinculoPessoa(b)));
}

/**
 * Processos em que a pessoa participa (parte cliente/oposta, titular, advogado ou nome no histórico).
 * @param {number|string} idPessoa
 * @param {string} [nomeCadastro]
 */
export async function carregarProcessosVinculoPessoa(idPessoa, nomeCadastro = '') {
  const id = Math.floor(Number(idPessoa));
  const nome = String(nomeCadastro ?? '').trim();
  const locais = listarProcessosPorIdPessoa(Number.isFinite(id) && id >= 1 ? id : '', nome || undefined);

  if (!featureFlags.useApiProcessos || !Number.isFinite(id) || id < 1) {
    return locais;
  }

  try {
    const apiRows = await listarProcessosVinculoPessoaDiagnostico(id);
    return mergeProcessosVinculoPessoa(apiRows, locais);
  } catch {
    return locais;
  }
}
