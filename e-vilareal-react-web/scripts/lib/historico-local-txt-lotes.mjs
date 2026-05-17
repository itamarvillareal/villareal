/**
 * Agrupa clientes em lotes equilibrados por nº de processos com ficheiros na pasta mil.
 */

import { DEFAULT_BASE_HISTORICO_LOCAL } from './historico-local-txt-paths.mjs';
import { listarProcessosHistoricoCliente } from './historico-local-txt-correcao.mjs';

/** Cliente com muitos processos — sempre lote dedicado. */
export const CLIENTE_LOTE_ISOLADO = 728;

/**
 * @param {object} opts
 * @param {string} [opts.base]
 * @param {number} [opts.metaProcessosPorLote] — alvo de processos por lote (exceto isolados)
 * @param {number[]} [opts.clientesIsolados]
 * @returns {{ lotes: { id: number, clientes: number[], processos: number }[], totalProcessos: number, totalClientes: number }}
 */
export function montarLotesCorrecaoHistorico(opts = {}) {
  const base = opts.base ?? DEFAULT_BASE_HISTORICO_LOCAL;
  const meta = opts.metaProcessosPorLote ?? 420;
  const isolados = new Set(opts.clientesIsolados ?? [CLIENTE_LOTE_ISOLADO]);

  /** @type {{ c: number, n: number }[]} */
  const clientes = [];
  for (let c = 1; c <= 999; c += 1) {
    const n = listarProcessosHistoricoCliente(base, c).length;
    if (n > 0) clientes.push({ c, n });
  }

  /** @type {{ id: number, clientes: number[], processos: number }[]} */
  const lotes = [];
  let id = 0;

  for (const iso of isolados) {
    const row = clientes.find((x) => x.c === iso);
    if (!row) continue;
    id += 1;
    lotes.push({ id, clientes: [row.c], processos: row.n, isolado: true });
  }

  const restantes = clientes
    .filter((x) => !isolados.has(x.c))
    .sort((a, b) => b.n - a.n);

  /** @type {{ id: number, clientes: number[], processos: number }[]} */
  const bins = [];

  for (const { c, n } of restantes) {
    if (n >= meta * 0.85) {
      id += 1;
      bins.push({ id, clientes: [c], processos: n, isolado: false });
      continue;
    }
    let melhor = -1;
    let menor = Infinity;
    for (let i = 0; i < bins.length; i += 1) {
      if (bins[i].processos < menor) {
        menor = bins[i].processos;
        melhor = i;
      }
    }
    if (melhor < 0 || bins[melhor].processos + n > meta * 1.15) {
      id += 1;
      bins.push({ id, clientes: [c], processos: n, isolado: false });
    } else {
      bins[melhor].clientes.push(c);
      bins[melhor].processos += n;
    }
  }

  lotes.push(...bins);
  lotes.sort((a, b) => a.id - b.id);

  const totalProcessos = clientes.reduce((s, x) => s + x.n, 0);
  return {
    lotes,
    totalProcessos,
    totalClientes: clientes.length,
    metaProcessosPorLote: meta,
  };
}
