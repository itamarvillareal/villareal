/**
 * Partes do **processo** nos txt legado (pasta Proc/1000/…), formulário «Processos».
 *
 * Não confundir com a pessoa do **cadastro do cliente** (`Gerais/…/151.1.0.txt`) — ver
 * `legado-pessoa-cliente-vs-partes-processo.mjs` e `cliente-pessoa-151-txt.mjs`.
 *
 * | Campo VBA              | Ficheiro                          | Polo API (UI)     |
 * |------------------------|-----------------------------------|-------------------|
 * | N Pessoa N Autor (slot cliente VBA) | {cod8}.90.{proc}.{NN} | polo API via papel_cliente |
 * | N End Pessoa N Autor                | {cod8}.91.{proc}.{NN} | (qualificação)             |
 * | N Pessoa N Réu (slot oposta VBA)    | {cod8}.95.{proc}.{NN} | polo API via papel_cliente |
 *
 * Títulos `1.N` / `6.N` não são importados nesta fase.
 */

import fs from 'node:fs';
import path from 'node:path';

import {
  centenaPastaClienteHistorico,
  formatCod8,
  pastaNumeroClienteHistorico,
  readOneLineFile,
  SEGMENTO_MIL,
} from './historico-local-txt-paths.mjs';
import { resolverBaseBancoDados } from './gerais-fase-processo-txt.mjs';
import {
  POLO_PROCESSO_PARTE_CLIENTE,
  POLO_PROCESSO_PARTE_OPOSTA,
  poloApiDesdeSlotVba,
} from './legado-pessoa-cliente-vs-partes-processo.mjs';
import {
  SEMANTIC_KEYS,
  normalizarPapelClienteTxt,
} from './proc-processo-semantic-txt.mjs';

/** Remapeamentos legado planilha → id pessoa na API (igual import-processos-complementar). */
export const REMAPEAR_PESSOA_PARTE = new Map([[9895, 1510]]);

const RE_PESSOA_AUTOR = /^(\d{8})\.90\.(\d+)\.(\d{2})\.txt$/i;
const RE_END_AUTOR = /^(\d{8})\.91\.(\d+)\.(\d{2})\.txt$/i;
const RE_PESSOA_REU = /^(\d{8})\.95\.(\d+)\.(\d{2})\.txt$/i;

/**
 * @param {string | number} raw
 * @returns {number | null}
 */
export function parsePessoaIdLegadoTxt(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s || !/^\d+$/.test(s)) return null;
  let n = Number.parseInt(s, 10);
  if (!Number.isFinite(n) || n < 1) return null;
  let changed = true;
  while (changed) {
    changed = false;
    const to = REMAPEAR_PESSOA_PARTE.get(n);
    if (to != null && to !== n) {
      n = to;
      changed = true;
    }
  }
  return n;
}

/**
 * @param {string} baseBanco
 * @param {number} codNum
 * @returns {string}
 */
export function dirProcCliente(baseBanco, codNum) {
  const cent = centenaPastaClienteHistorico(codNum);
  const pastaCli = pastaNumeroClienteHistorico(codNum);
  return path.join(baseBanco, 'Proc', SEGMENTO_MIL, String(cent), pastaCli);
}

/**
 * @typedef {object} ParteProcessoTxt
 * @property {number} ordem — 1..N (sufixo 01, 02 no ficheiro 90/95)
 * @property {'AUTOR' | 'REU'} ladoVba — lado no processo (90=Autor, 95=Réu), não é o 151.1.0
 * @property {number | null} pessoaId
 * @property {string | null} enderecoRef — texto em 91 (índice endereço legado)
 * @property {string[]} fontes
 */

/**
 * @param {string} dir
 * @param {string} cod8
 * @param {number} procNum
 * @returns {ParteProcessoTxt[]}
 */
export function lerPartesProcessoTxtDir(dir, cod8, procNum) {
  if (!fs.existsSync(dir)) return [];

  /** @type {Map<string, ParteProcessoTxt>} */
  const porChave = new Map();

  /**
   * @param {'AUTOR' | 'REU'} ladoVba
   * @param {number} ordem
   */
  function slot(ladoVba, ordem) {
    const k = `${ladoVba}|${ordem}`;
    let s = porChave.get(k);
    if (!s) {
      s = { ordem, ladoVba, pessoaId: null, enderecoRef: null, fontes: [] };
      porChave.set(k, s);
    }
    return s;
  }

  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return [];
  }

  for (const nome of entries) {
    if (!nome.toLowerCase().endsWith('.txt')) continue;
    const abs = path.join(dir, nome);

    let m = RE_PESSOA_AUTOR.exec(nome);
    if (m && m[1] === cod8 && Number(m[2]) === procNum) {
      const ordem = Number.parseInt(m[3], 10);
      if (ordem >= 1) {
        const s = slot(POLO_PROCESSO_PARTE_CLIENTE, ordem);
        s.pessoaId = parsePessoaIdLegadoTxt(readOneLineFile(abs));
        s.fontes.push(nome);
      }
      continue;
    }

    m = RE_END_AUTOR.exec(nome);
    if (m && m[1] === cod8 && Number(m[2]) === procNum) {
      const ordem = Number.parseInt(m[3], 10);
      if (ordem >= 1) {
        const s = slot(POLO_PROCESSO_PARTE_CLIENTE, ordem);
        s.enderecoRef = readOneLineFile(abs);
        s.fontes.push(nome);
      }
      continue;
    }

    m = RE_PESSOA_REU.exec(nome);
    if (m && m[1] === cod8 && Number(m[2]) === procNum) {
      const ordem = Number.parseInt(m[3], 10);
      if (ordem >= 1) {
        const s = slot(POLO_PROCESSO_PARTE_OPOSTA, ordem);
        s.pessoaId = parsePessoaIdLegadoTxt(readOneLineFile(abs));
        s.fontes.push(nome);
      }
    }
  }

  return [...porChave.values()]
    .sort((a, b) => a.ladoVba.localeCompare(b.ladoVba) || a.ordem - b.ordem)
    .filter((p) => p.pessoaId != null);
}

/**
 * @param {string} [baseBanco]
 * @param {number} codNum
 * @param {number} procNum
 */
export function lerPartesProcessoTxt(baseBanco = resolverBaseBancoDados(), codNum, procNum) {
  const cod8 = formatCod8(codNum);
  const dir = dirProcCliente(baseBanco, codNum);
  return lerPartesProcessoTxtDir(dir, cod8, procNum);
}

/**
 * Processos com pelo menos um ficheiro 90 ou 95 (partes do processo).
 * @param {string} baseBanco
 * @param {number} codNum
 * @returns {number[]}
 */
export function listarProcessosComPartesTxt(baseBanco, codNum) {
  const dir = dirProcCliente(baseBanco, codNum);
  if (!fs.existsSync(dir)) return [];

  const cod8 = formatCod8(codNum);
  /** @type {Set<number>} */
  const procs = new Set();

  for (const nome of fs.readdirSync(dir)) {
    if (!nome.toLowerCase().endsWith('.txt')) continue;
    for (const re of [RE_PESSOA_AUTOR, RE_PESSOA_REU]) {
      const m = re.exec(nome);
      if (m && m[1] === cod8) {
        const p = Number.parseInt(m[2], 10);
        if (Number.isFinite(p) && p >= 1) procs.add(p);
        break;
      }
    }
  }

  return [...procs].sort((a, b) => a - b);
}

/**
 * @param {string} baseBanco
 * @param {number} codNum
 * @param {number} procNum
 * @returns {'REQUERENTE' | 'REQUERIDO' | null}
 */
export function lerPapelClienteProcessoTxt(baseBanco, codNum, procNum) {
  const cod8 = formatCod8(codNum);
  const dir = dirProcCliente(baseBanco, codNum);
  const nome = `${cod8}.${SEMANTIC_KEYS.PAPEL_CLIENTE}.Processo${procNum}.Processos.txt`;
  const abs = path.join(dir, nome);
  if (!fs.existsSync(abs)) return null;
  return normalizarPapelClienteTxt(readOneLineFile(abs));
}

/**
 * @param {ParteProcessoTxt} p
 * @param {string | null | undefined} [papelCliente]
 */
export function parteTxtParaApiBody(p, papelCliente = null) {
  const qualificacao =
    p.enderecoRef != null && String(p.enderecoRef).trim()
      ? `endereco:${String(p.enderecoRef).trim()}`
      : null;
  return {
    pessoaId: p.pessoaId ?? null,
    nomeLivre: null,
    polo: poloApiDesdeSlotVba(p.ladoVba, papelCliente),
    qualificacao,
    ordem: p.ordem,
    advogadoPessoaIds: [],
  };
}

/**
 * @param {object} api
 * @param {ReturnType<typeof parteTxtParaApiBody>} body
 */
export function assinaturaParteApi(api, body) {
  const pid = api?.pessoaId ?? body?.pessoaId ?? null;
  const nome = String(api?.nomeLivre ?? body?.nomeLivre ?? '')
    .trim()
    .toUpperCase();
  const polo = String(api?.polo ?? body?.polo ?? '').toUpperCase();
  const ordem = Number(api?.ordem ?? body?.ordem ?? 0);
  return `${polo}|${pid ?? ''}|${nome}|${ordem}`;
}
