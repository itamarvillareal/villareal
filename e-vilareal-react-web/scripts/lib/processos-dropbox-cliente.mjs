/**
 * Lista de processos do cliente a partir de ficheiros no Dropbox («Banco de Dados»).
 * Fonte de verdade para alinhar MySQL ↔ txt (não usar faixas 1..999 sem ficheiro).
 */

import fs from 'node:fs';
import path from 'node:path';

import { resolverBaseBancoDados } from './gerais-fase-processo-txt.mjs';
import { MAPA_TIPO_NUMERICO_VB } from './proc-processo-cabecalho-txt.mjs';
import { listarProcessosHistoricoCliente } from './historico-local-txt-correcao.mjs';
import {
  centenaPastaClienteHistorico,
  formatCod8,
  pastaNumeroClienteHistorico,
  SEGMENTO_MIL,
} from './historico-local-txt-paths.mjs';

const TIPOS_CABECALHO_IMPORT = new Set(Object.keys(MAPA_TIPO_NUMERICO_VB));

/**
 * @param {string} baseBanco
 * @param {number} codNum
 * @returns {number[]}
 */
export function listarProcessosComCabecalhoTxt(baseBanco, codNum) {
  const cent = centenaPastaClienteHistorico(codNum);
  const pastaCli = pastaNumeroClienteHistorico(codNum);
  const cod8 = formatCod8(codNum);
  const dir = path.join(baseBanco, 'Proc', SEGMENTO_MIL, String(cent), pastaCli);
  if (!fs.existsSync(dir)) return [];

  const re = new RegExp(`^${cod8}\\.3\\.1\\.(\\d+)\\.txt$`, 'i');
  /** @type {number[]} */
  const procs = [];
  for (const f of fs.readdirSync(dir)) {
    const m = re.exec(f);
    if (m) procs.push(Number.parseInt(m[1], 10));
  }
  return [...new Set(procs)].sort((a, b) => a - b);
}

/**
 * @param {string} baseBanco
 * @param {number} codNum
 * @returns {number[]}
 */
export function listarProcessosComDadosCabecalhoTxt(baseBanco, codNum) {
  const cent = centenaPastaClienteHistorico(codNum);
  const pastaCli = pastaNumeroClienteHistorico(codNum);
  const cod8 = formatCod8(codNum);
  const re = new RegExp(
    `^${cod8.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.([0-9]+(?:\\.[0-9]+)*)\\.(\\d+)\\.txt$`,
    'i'
  );
  const procs = new Set();
  for (const sub of ['Proc', 'Gerais']) {
    const dir = path.join(baseBanco, sub, SEGMENTO_MIL, String(cent), pastaCli);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      const m = re.exec(f);
      if (!m) continue;
      if (!TIPOS_CABECALHO_IMPORT.has(m[1])) continue;
      const proc = Number.parseInt(m[2], 10);
      if (Number.isFinite(proc) && proc >= 0) procs.add(proc);
    }
  }
  return [...procs].sort((a, b) => a - b);
}

/**
 * @param {string} baseBanco
 * @param {number} codNum
 * @returns {number[]}
 */
export function listarProcessosIndice152Cliente(baseBanco, codNum) {
  const cent = centenaPastaClienteHistorico(codNum);
  const pastaCli = pastaNumeroClienteHistorico(codNum);
  const cod8 = formatCod8(codNum);
  const re = new RegExp(`^${cod8.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.152\\.1\\.(\\d+)\\.txt$`, 'i');
  /** @type {number[]} */
  const procs = [];
  for (const pre of ['HC', 'Historico de Consultas Inativos']) {
    const dir = path.join(baseBanco, pre, SEGMENTO_MIL, String(cent), pastaCli);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      const m = re.exec(f);
      if (m) procs.push(Number.parseInt(m[1], 10));
    }
  }
  return [...new Set(procs)].sort((a, b) => a - b);
}

/**
 * União Dropbox: 3.1 + histórico HC/Inativos + índice 152.1 (só nº interno com ficheiro).
 * @param {string} [baseBanco]
 * @param {number} codNum
 * @returns {number[]}
 */
export function listarProcessosDropboxCliente(baseBanco, codNum) {
  const base = baseBanco ?? resolverBaseBancoDados();
  const set = new Set();
  for (const p of listarProcessosComCabecalhoTxt(base, codNum)) set.add(p);
  for (const p of listarProcessosHistoricoCliente(base, codNum)) set.add(p);
  for (const p of listarProcessosIndice152Cliente(base, codNum)) set.add(p);
  return [...set].sort((a, b) => a - b);
}

/**
 * @param {import('mysql2/promise').Connection | import('./mysql-vilareal.mjs').DockerMysqlAdapter} conn
 * @param {number[]} processoIds
 */
export async function apagarProcessosDependentesPorIds(conn, processoIds) {
  const ids = processoIds.filter((id) => Number.isFinite(id) && id >= 1);
  if (!ids.length) return;

  const ph = ids.map(() => '?').join(',');
  await conn.query(
    `UPDATE processo_prazo SET andamento_id = NULL
     WHERE andamento_id IN (SELECT id FROM processo_andamento WHERE processo_id IN (${ph}))`,
    ids
  );
  await conn.query(`DELETE FROM processo_andamento WHERE processo_id IN (${ph})`, ids);
  await conn.query(
    `DELETE ppa FROM processo_parte_advogado ppa
     INNER JOIN processo_parte pp ON pp.id = ppa.processo_parte_id
     WHERE pp.processo_id IN (${ph})`,
    ids
  );
  await conn.query(`DELETE FROM processo_parte WHERE processo_id IN (${ph})`, ids);
  await conn.query(`UPDATE imovel SET processo_id = NULL WHERE processo_id IN (${ph})`, ids);
  await conn.query(`DELETE FROM processo WHERE id IN (${ph})`, ids);
}

/**
 * Apaga na base processos da pessoa que não existem no Dropbox (lista de nº interno).
 * Lista vazia = Dropbox sem processos → remove todos os processos dessa pessoa.
 * @param {import('mysql2/promise').Connection | import('./mysql-vilareal.mjs').DockerMysqlAdapter} conn
 * @param {number} pessoaId
 * @param {number[]} numerosDropbox
 */
export async function removerProcessosForaDropboxMysql(conn, pessoaId, numerosDropbox) {
  const pid = Math.trunc(Number(pessoaId));
  const nums = [
    ...new Set(
      numerosDropbox.map((n) => Math.trunc(Number(n))).filter((n) => Number.isFinite(n) && n >= 1)
    ),
  ];

  if (!Number.isFinite(pid) || pid < 1) {
    return { removidos: 0, numerosRemovidos: [], processosMysql: 0 };
  }

  /** @type {{ id: number, ni: number }[]} */
  let alvo = [];
  if (nums.length === 0) {
    const [rows] = await conn.query(`SELECT id, numero_interno AS ni FROM processo WHERE pessoa_id = ?`, [
      pid,
    ]);
    alvo = rows.map((r) => ({ id: Number(r.id), ni: Number(r.ni) }));
  } else {
    const ph = nums.map(() => '?').join(',');
    const [rows] = await conn.query(
      `SELECT id, numero_interno AS ni FROM processo
       WHERE pessoa_id = ? AND numero_interno NOT IN (${ph})`,
      [pid, ...nums]
    );
    alvo = rows.map((r) => ({ id: Number(r.id), ni: Number(r.ni) }));
  }

  if (!alvo.length) {
    const [[c]] = await conn.query(`SELECT COUNT(*) AS n FROM processo WHERE pessoa_id = ?`, [pid]);
    return { removidos: 0, numerosRemovidos: [], processosMysql: Number(c?.n ?? 0) };
  }

  const ids = alvo.map((r) => r.id);
  await apagarProcessosDependentesPorIds(conn, ids);

  const [[c]] = await conn.query(`SELECT COUNT(*) AS n FROM processo WHERE pessoa_id = ?`, [pid]);
  return {
    removidos: alvo.length,
    numerosRemovidos: alvo.map((r) => r.ni).slice(0, 40),
    processosMysql: Number(c?.n ?? 0),
  };
}
