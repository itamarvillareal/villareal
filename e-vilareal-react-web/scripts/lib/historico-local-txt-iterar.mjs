/**
 * Itera entradas de histórico local (txt) — mesma regra que `extrair-historico-local-txt-para-xls.mjs`.
 * Chave: código cliente (8 dígitos) + número interno do processo; cada índice 1..N = data + informação + utilizador.
 */

import {
  DEFAULT_BASE_HISTORICO_LOCAL,
  MAX_CLIENTE_HISTORICO_LOCAL,
  carregarContagensOpcional,
  formatCod8,
  formatIndice4,
  formatProcNomeArquivo,
  lerMaxIndiceHistorico,
  maxProcParaCliente,
} from './historico-local-txt-paths.mjs';
import { lerConteudoEntradaHistorico } from './historico-local-txt-entrada.mjs';

/**
 * @typedef {object} EntradaHistoricoLocal
 * @property {string} codigoCliente8
 * @property {number} codNum
 * @property {number} numeroInterno
 * @property {string} procStr
 * @property {number} indice — posição 1..N no processo (ficheiro …0001, 0002, …)
 * @property {string} indice4
 * @property {string} dataBruta — texto do tipo 16
 * @property {number | null} yyyyPasta
 * @property {number | null} mmPasta
 * @property {string} informacao — tipo 15
 * @property {string} usuarioBruto — tipo 17
 * @property {string | null} infoArquivoAbs — ficheiro tipo 15 (informação)
 * @property {string | null} localAposBancoDeDados
 */

/**
 * @param {object} opts
 * @param {string} opts.base
 * @param {number} opts.clienteMin
 * @param {number} opts.clienteMax
 * @param {string | null} [opts.contagensPath]
 * @param {number} [opts.limiteEntradas] — 0 = sem limite
 * @param {number | null} [opts.filtroClienteCod] — só este cliente (número 1..999)
 * @param {number | null} [opts.filtroProcesso]
 * @param {number | null} [opts.indiceMin] — só índices >= (ex.: sync incremental)
 * @param {number | null} [opts.indiceMax]
 * @yields {EntradaHistoricoLocal}
 */
export function* iterarEntradasHistoricoLocal(opts) {
  const base = opts.base || DEFAULT_BASE_HISTORICO_LOCAL;
  const clienteMin = opts.clienteMin ?? 1;
  const clienteMax = opts.clienteMax ?? MAX_CLIENTE_HISTORICO_LOCAL;
  const limite = opts.limiteEntradas ?? 0;
  const contagens = carregarContagensOpcional(opts.contagensPath ?? null);
  let emitidas = 0;

  const codLo = opts.filtroClienteCod != null ? opts.filtroClienteCod : clienteMin;
  const codHi = opts.filtroClienteCod != null ? opts.filtroClienteCod : clienteMax;
  const lista =
    Array.isArray(opts.clientesLista) && opts.clientesLista.length
      ? [...new Set(opts.clientesLista.map((c) => Math.trunc(Number(c))).filter((c) => c >= 1 && c <= 999))].sort(
          (a, b) => a - b
        )
      : null;

  const codigos = lista ?? [];
  if (!lista) {
    for (let cod = codLo; cod <= codHi; cod += 1) codigos.push(cod);
  }

  for (const cod of codigos) {
    const cod8 = formatCod8(cod);
    const maxProc = maxProcParaCliente(cod, contagens);

    for (let proc = 1; proc <= maxProc; proc += 1) {
      if (opts.filtroProcesso != null && proc !== opts.filtroProcesso) continue;

      const procStr = formatProcNomeArquivo(proc);
      if (!procStr) continue;

      const maxIdx = lerMaxIndiceHistorico(base, cod8, cod, procStr);
      if (maxIdx == null) continue;

      const iMin = opts.indiceMin != null ? Math.max(1, Math.trunc(opts.indiceMin)) : 1;
      const iMax = opts.indiceMax != null ? Math.min(maxIdx, Math.trunc(opts.indiceMax)) : maxIdx;

      for (let i = iMin; i <= iMax; i += 1) {
        if (limite > 0 && emitidas >= limite) return;

        const c = lerConteudoEntradaHistorico(base, cod8, cod, procStr, i);
        if (!c.infoTrim && !c.dataTrim) continue;
        if (c.dataTrim && !c.infoTrim) continue;

        const infoTrim = c.infoTrim;
        const dataTrim = c.dataTrim;
        const userTrim = c.userTrim;
        const idx4 = c.idx4;

        emitidas += 1;
        yield {
          codigoCliente8: cod8,
          codNum: cod,
          numeroInterno: proc,
          procStr,
          indice: i,
          indice4: idx4,
          dataBruta: dataTrim,
          yyyyPasta: c.yyyyPasta,
          mmPasta: c.mmPasta,
          informacao: infoTrim,
          usuarioBruto: userTrim,
          infoArquivoAbs: c.infoArquivoAbs ?? null,
          localAposBancoDeDados: null,
        };
      }
    }
  }
}

/** @param {Iterable<EntradaHistoricoLocal>} entradas */
export function coletarEntradasHistoricoLocal(opts) {
  return [...iterarEntradasHistoricoLocal(opts)];
}
