/**
 * Varredura da pasta HC (e subpastas Ano) por ficheiros txt de histórico alterados num dia.
 */

import fs from 'node:fs';
import path from 'node:path';

import { PREFIXOS, SEGMENTO_MIL } from './historico-local-txt-paths.mjs';

/** @typedef {'14' | '15' | '16' | '17' | 'outro'} TipoHistoricoTxt */

/**
 * @typedef {object} ArquivoHistoricoAlterado
 * @property {string} abs
 * @property {string} relAposHc — caminho POSIX após «…/HC/»
 * @property {number} mtimeMs
 * @property {TipoHistoricoTxt} tipo
 * @property {string} cod8
 * @property {number} codNum
 * @property {string} procStr
 * @property {number} procNum
 * @property {number | null} indice — só tipos 15/16/17
 */

/**
 * @typedef {object} ScanHistoricoHcAlterados
 * @property {ArquivoHistoricoAlterado[]} todos
 * @property {ArquivoHistoricoAlterado[]} tipo14
 * @property {ArquivoHistoricoAlterado[]} tipo15_16_17
 * @property {ArquivoHistoricoAlterado[]} outros
 * @property {Map<string, { cod8: string, codNum: number, procStr: string, procNum: number }>} processos
 */

const RE_14 = /^(\d{8})\.14\.1\.(\d+)\.txt$/i;
const RE_LINHA = /^(\d{8})\.(15|16|17)\.1\.(\d+)\.(\d{4})\.txt$/i;

/**
 * Início do dia local (00:00:00.000).
 * @param {Date} [ref]
 */
export function inicioDiaLocal(ref = new Date()) {
  return new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 0, 0, 0, 0);
}

/**
 * @param {Date | string} dia — Date ou `YYYY-MM-DD`
 */
export function parseDiaArg(dia) {
  if (dia instanceof Date) return inicioDiaLocal(dia);
  const s = String(dia).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new Error(`Data inválida (use YYYY-MM-DD): ${s}`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
}

/**
 * @param {number} mtimeMs
 * @param {Date} inicioDia
 * @param {Date} fimDia — exclusivo (início do dia seguinte)
 */
export function mtimeNoDia(mtimeMs, inicioDia, fimDia) {
  return mtimeMs >= inicioDia.getTime() && mtimeMs < fimDia.getTime();
}

/**
 * @param {string} nome
 */
function classificarNomeHistorico(nome) {
  const m14 = RE_14.exec(nome);
  if (m14) {
    const cod8 = m14[1];
    const procStr = m14[2];
    const codNum = Number.parseInt(cod8, 10);
    const procNum = Number.parseInt(procStr, 10);
    if (!Number.isFinite(codNum) || !Number.isFinite(procNum) || procNum < 1) return null;
    return {
      tipo: /** @type {const} */ ('14'),
      cod8,
      codNum,
      procStr,
      procNum,
      indice: null,
    };
  }
  const m = RE_LINHA.exec(nome);
  if (m) {
    const cod8 = m[1];
    const tipo = m[2];
    const procStr = m[3];
    const indice = Number.parseInt(m[4], 10);
    const codNum = Number.parseInt(cod8, 10);
    const procNum = Number.parseInt(procStr, 10);
    if (!Number.isFinite(codNum) || !Number.isFinite(procNum) || !Number.isFinite(indice) || procNum < 1) {
      return null;
    }
    return {
      tipo: /** @type {TipoHistoricoTxt} */ (tipo),
      cod8,
      codNum,
      procStr,
      procNum,
      indice,
    };
  }
  return null;
}

/**
 * @param {string} base — raiz «Banco de Dados»
 * @param {Date} inicioDia
 * @param {Date} fimDia
 * @returns {ScanHistoricoHcAlterados}
 */
export function scanHistoricoHcAlteradosNoDia(base, inicioDia, fimDia) {
  const hcRoot = path.join(base, 'HC');
  /** @type {ArquivoHistoricoAlterado[]} */
  const todos = [];
  /** @type {Map<string, { cod8: string, codNum: number, procStr: string, procNum: number }>} */
  const processos = new Map();

  function chaveProcesso(cod8, procNum) {
    return `${cod8}|${procNum}`;
  }

  function registrarProcesso(meta) {
    processos.set(chaveProcesso(meta.cod8, meta.procNum), {
      cod8: meta.cod8,
      codNum: meta.codNum,
      procStr: meta.procStr,
      procNum: meta.procNum,
    });
  }

  /** @param {string} dir */
  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(abs);
        continue;
      }
      if (!ent.isFile() || !ent.name.toLowerCase().endsWith('.txt')) continue;

      let st;
      try {
        st = fs.statSync(abs);
      } catch {
        continue;
      }
      if (!mtimeNoDia(st.mtimeMs, inicioDia, fimDia)) continue;

      const meta = classificarNomeHistorico(ent.name);
      const relAposHc = path.relative(hcRoot, abs).split(path.sep).join('/');
      if (!meta) {
        todos.push({
          abs,
          relAposHc,
          mtimeMs: st.mtimeMs,
          tipo: 'outro',
          cod8: '',
          codNum: 0,
          procStr: '',
          procNum: 0,
          indice: null,
        });
        continue;
      }

      const row = {
        abs,
        relAposHc,
        mtimeMs: st.mtimeMs,
        tipo: meta.tipo,
        cod8: meta.cod8,
        codNum: meta.codNum,
        procStr: meta.procStr,
        procNum: meta.procNum,
        indice: meta.indice,
      };
      todos.push(row);
      registrarProcesso(meta);
    }
  }

  if (fs.existsSync(hcRoot)) walk(hcRoot);

  const tipo14 = todos.filter((f) => f.tipo === '14');
  const tipo15_16_17 = todos.filter((f) => f.tipo === '15' || f.tipo === '16' || f.tipo === '17');
  const outros = todos.filter((f) => f.tipo === 'outro');

  return { todos, tipo14, tipo15_16_17, outros, processos };
}

/** Lista prefixos HC conhecidos (informativo). */
export function prefixosHcHistorico() {
  return [...PREFIXOS, SEGMENTO_MIL, 'Ano'];
}
