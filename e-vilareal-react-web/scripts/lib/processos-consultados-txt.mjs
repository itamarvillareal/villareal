/**
 * Lista pares código cliente + proc. consultados num dia — fonte txt HC (Dropbox).
 *
 * Alinhado ao popup Excel «Processos Consultados em DD/MM/AAAA»: inclui processos
 * cujo único movimento do dia seja título automático VB (JUNTAR PETIÇÃO… / PETIÇÃO DA INF…).
 *
 * Varredura rápida: ficheiros tipo **15** em `HC/Ano/aaaa/mm` (+ legado `aaaa/mm` e Inativos),
 * validação da data via tipo **16** (`lerConteudoEntradaHistorico` + `movimentoEmFromHistoricoLocal`).
 */

import fs from 'node:fs';
import path from 'node:path';

import {
  DEFAULT_BASE_HISTORICO_LOCAL,
  PREFIXOS,
  formatCod8,
} from './historico-local-txt-paths.mjs';
import { lerConteudoEntradaHistorico } from './historico-local-txt-entrada.mjs';
import { movimentoEmFromHistoricoLocal } from './historico-movimento-em.mjs';
import {
  agruparConsultasRealizadasPorProcesso,
  agruparProcessosConsultadosPorProcesso,
  ehTituloHistoricoSistemaLegado,
} from '../../src/domain/historicoTituloLegadoSistema.js';

const RE15 = /^(\d{8})\.15\.1\.(\d+)\.(\d{4})\.txt$/i;

/**
 * @param {string} val — `YYYY-MM-DD`, `DD/MM/YYYY` ou `D/M/YYYY`
 * @returns {{ iso: string, br: string, ano: number, mes: number } | null}
 */
export function parseDataConsultadosArg(val) {
  const s = String(val ?? '').trim();
  if (!s) return null;

  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    const ano = Number(m[1]);
    const mes = Number(m[2]);
    const dia = Number(m[3]);
    if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
    return {
      iso: `${m[1]}-${m[2]}-${m[3]}`,
      br: `${m[3]}/${m[2]}/${m[1]}`,
      ano,
      mes,
    };
  }

  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) {
    const dia = Number(m[1]);
    const mes = Number(m[2]);
    const ano = Number(m[3]);
    if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
    return {
      iso: `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`,
      br: `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`,
      ano,
      mes,
    };
  }

  return null;
}

/** @param {Date} [ref] */
export function dataConsultadosHoje(ref = new Date()) {
  const ano = ref.getFullYear();
  const mes = ref.getMonth() + 1;
  const dia = ref.getDate();
  return {
    iso: `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`,
    br: `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`,
    ano,
    mes,
  };
}

/**
 * @param {object} opts
 * @param {string} [opts.base]
 * @param {string} opts.dataIso — `YYYY-MM-DD`
 * @param {number} opts.ano
 * @param {number} opts.mes — 1..12
 * @param {boolean} [opts.excluirTitulosAutomaticos] — modo «Consultas Realizadas» (defeito: false)
 * @returns {{ candidatos: number, itens: Array<{ codNum: number, codigoCliente8: string, proc: number, indice: number, info: string, tituloAutomatico: boolean, dataBruta: string }> }}
 */
export function listarProcessosConsultadosTxt(opts) {
  const base = opts.base || DEFAULT_BASE_HISTORICO_LOCAL;
  const dataIso = opts.dataIso;
  const ano = opts.ano;
  const mes = opts.mes;
  const excluirAuto = opts.excluirTitulosAutomaticos === true;

  /** @type {Map<string, true>} */
  const vistos = new Set();
  /** @type {Array<Record<string, unknown>>} */
  const linhas = [];
  let candidatos = 0;

  for (const pre of PREFIXOS) {
    const preAbs = path.join(base, pre);
    for (const sub of [`Ano/${ano}/${String(mes).padStart(2, '0')}`, `${ano}/${String(mes).padStart(2, '0')}`]) {
      const dir = path.join(preAbs, sub);
      if (!fs.existsSync(dir)) continue;

      for (const f of fs.readdirSync(dir)) {
        const m = RE15.exec(f);
        if (!m) continue;

        const cod8 = m[1];
        const procStr = m[2];
        const idx4 = m[3];
        const codNum = Number.parseInt(cod8, 10);
        const proc = Number.parseInt(procStr, 10);
        const indice = Number.parseInt(idx4, 10);
        if (!Number.isFinite(codNum) || !Number.isFinite(proc) || proc < 1 || indice < 1) continue;

        const chaveEntrada = `${cod8}:${procStr}:${idx4}`;
        if (vistos.has(chaveEntrada)) continue;
        vistos.add(chaveEntrada);
        candidatos += 1;

        const c = lerConteudoEntradaHistorico(base, cod8, codNum, procStr, indice);
        if (!c.valido) continue;

        const mov = movimentoEmFromHistoricoLocal(c.dataTrim, c.yyyyPasta, c.mmPasta, c.infoArquivoAbs);
        if (!mov || mov.slice(0, 10) !== dataIso) continue;

        const info = String(c.infoTrim ?? '').trim();
        if (!info) continue;
        if (excluirAuto && ehTituloHistoricoSistemaLegado(info)) continue;

        linhas.push({
          codCliente: cod8,
          codigoCliente8: cod8,
          codNum,
          proc,
          numeroInterno: proc,
          indice,
          id: indice,
          info,
          tituloAutomatico: ehTituloHistoricoSistemaLegado(info),
          dataBruta: c.dataTrim,
        });
      }
    }
  }

  const agrupadas = excluirAuto
    ? agruparConsultasRealizadasPorProcesso(linhas)
    : agruparProcessosConsultadosPorProcesso(linhas);

  return {
    candidatos,
    itens: agrupadas
      .map((row) => ({
        codNum: row.codNum ?? Number.parseInt(String(row.codigoCliente8 ?? row.codCliente ?? '0'), 10),
        codigoCliente8: formatCod8(row.codNum ?? row.codigoCliente8 ?? row.codCliente),
        proc: Number(row.proc ?? row.numeroInterno),
        indice: row.indice,
        info: row.info,
        tituloAutomatico: row.tituloAutomatico === true || ehTituloHistoricoSistemaLegado(row.info),
        dataBruta: row.dataBruta ?? '',
      }))
      .sort((a, b) => (a.codNum !== b.codNum ? a.codNum - b.codNum : a.proc - b.proc)),
  };
}

export function formatarParConsultado(row) {
  const cod = formatCod8(row.codNum);
  const proc = String(Math.trunc(Number(row.proc))).padStart(2, '0');
  return `${cod},${proc}`;
}
