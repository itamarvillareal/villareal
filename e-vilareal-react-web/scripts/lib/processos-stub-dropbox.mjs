import fs from 'node:fs';
import path from 'node:path';

import {
  centenaPastaClienteHistorico,
  pastaNumeroClienteHistorico,
  SEGMENTO_MIL,
} from './historico-local-txt-paths.mjs';
import { listarProcessosDropboxCliente } from './processos-dropbox-cliente.mjs';

/**
 * @param {string} baseBanco
 * @param {number} codNum
 */
export function pastaProcClienteExiste(baseBanco, codNum) {
  const cent = centenaPastaClienteHistorico(codNum);
  const pastaCli = pastaNumeroClienteHistorico(codNum);
  const dir = path.join(baseBanco, 'Proc', SEGMENTO_MIL, String(cent), pastaCli);
  return fs.existsSync(dir);
}

/**
 * @param {number[]} numerosDropbox
 * @returns {number[]}
 */
export function normalizarNumerosDropbox(numerosDropbox) {
  return [
    ...new Set(
      numerosDropbox.map((n) => Math.trunc(Number(n))).filter((n) => Number.isFinite(n) && n >= 0)
    ),
  ];
}

/**
 * @param {import('mysql2/promise').Connection | import('./mysql-vilareal.mjs').DockerMysqlAdapter} conn
 * @param {number} pessoaId
 * @param {number[]} numerosDropbox
 * @param {{ exigirPastaProc?: boolean, codNum?: number, baseBanco?: string }} [opts]
 */
export async function listarProcessosStubLimpeza(conn, pessoaId, numerosDropbox, opts = {}) {
  const pid = Math.trunc(Number(pessoaId));
  if (!Number.isFinite(pid) || pid < 1) {
    return { candidatos: [], motivoSkip: 'pessoa_invalida' };
  }

  const nums = normalizarNumerosDropbox(numerosDropbox);
  const codNum = opts.codNum;
  const baseBanco = opts.baseBanco;

  if (opts.exigirPastaProc !== false && codNum != null && baseBanco) {
    if (pastaProcClienteExiste(baseBanco, codNum) && nums.length === 0) {
      return { candidatos: [], motivoSkip: 'dropbox_vazio_com_pasta' };
    }
    if (!pastaProcClienteExiste(baseBanco, codNum) && nums.length === 0) {
      const [rows] = await conn.query(
        `SELECT p.id, p.numero_interno AS ni
         FROM processo p
         WHERE p.pessoa_id = ?
           AND NOT EXISTS (SELECT 1 FROM processo_andamento a WHERE a.processo_id = p.id)
           AND NOT EXISTS (SELECT 1 FROM processo_parte pp WHERE pp.processo_id = p.id)`,
        [pid]
      );
      return {
        candidatos: rows.map((r) => ({ id: Number(r.id), ni: Number(r.ni) })),
        motivoSkip: null,
      };
    }
  }

  if (nums.length === 0) {
    return { candidatos: [], motivoSkip: 'dropbox_vazio' };
  }

  const ph = nums.map(() => '?').join(',');
  const [rows] = await conn.query(
    `SELECT p.id, p.numero_interno AS ni
     FROM processo p
     WHERE p.pessoa_id = ?
       AND p.numero_interno NOT IN (${ph})
       AND NOT EXISTS (SELECT 1 FROM processo_andamento a WHERE a.processo_id = p.id)
       AND NOT EXISTS (SELECT 1 FROM processo_parte pp WHERE pp.processo_id = p.id)`,
    [pid, ...nums]
  );

  return {
    candidatos: rows.map((r) => ({ id: Number(r.id), ni: Number(r.ni) })),
    motivoSkip: null,
  };
}

/**
 * @param {import('mysql2/promise').Connection | import('./mysql-vilareal.mjs').DockerMysqlAdapter} conn
 * @param {number} pessoaId
 * @param {string} cod8
 * @param {number[]} numerosDropbox
 */
export async function medirTamanhoClienteMysqlRapido(conn, pessoaId, cod8, numerosDropbox) {
  const pid = Math.trunc(Number(pessoaId));
  const nums = normalizarNumerosDropbox(numerosDropbox);
  const ph = nums.length ? nums.map(() => '?').join(',') : null;

  const [[agg]] = await conn.query(
    `SELECT
       COUNT(*) AS processosMysql,
       SUM(TRIM(COALESCE(p.descricao_acao,'')) = '') AS semDescricao,
       SUM(CASE WHEN ${ph ? `p.numero_interno NOT IN (${ph})` : '1=1'} THEN 1 ELSE 0 END) AS foraDropbox
     FROM processo p WHERE p.pessoa_id = ?`,
    ph ? [...nums, pid] : [pid]
  );

  const [[dep]] = await conn.query(
    `SELECT
       (SELECT COUNT(*) FROM processo_andamento a
        INNER JOIN processo p ON p.id = a.processo_id WHERE p.pessoa_id = ?) AS andamentos,
       (SELECT COUNT(*) FROM processo_parte pp
        INNER JOIN processo p ON p.id = pp.processo_id WHERE p.pessoa_id = ?) AS partes,
       (SELECT COUNT(*) FROM processo p
        WHERE p.pessoa_id = ?
          AND NOT EXISTS (SELECT 1 FROM processo_andamento a WHERE a.processo_id = p.id)) AS semAndamento`,
    [pid, pid, pid]
  );

  const [[calc]] = await conn.query(
    `SELECT COUNT(*) AS n, COALESCE(SUM(LENGTH(payload_json)), 0) AS bytes
     FROM calculo_rodada WHERE TRIM(codigo_cliente) = ?`,
    [cod8]
  );

  const vazioComTxt =
    nums.length === 0
      ? 0
      : Number(
          (
            await conn.query(
              `SELECT COUNT(*) AS n FROM processo p
               WHERE p.pessoa_id = ?
                 AND p.numero_interno IN (${ph})
                 AND NOT EXISTS (SELECT 1 FROM processo_andamento a WHERE a.processo_id = p.id)`,
              [...nums, pid]
            )
          )[0][0]?.n ?? 0
        );

  return {
    processosMysql: Number(agg?.processosMysql ?? 0),
    processosDropbox: nums.length,
    foraDropbox: Number(agg?.foraDropbox ?? 0),
    semAndamento: Number(dep?.semAndamento ?? 0),
    vazioComTxt,
    semDescricao: Number(agg?.semDescricao ?? 0),
    andamentos: Number(dep?.andamentos ?? 0),
    partes: Number(dep?.partes ?? 0),
    calculoRodadas: Number(calc?.n ?? 0),
    calculoBytes: Number(calc?.bytes ?? 0),
  };
}

/**
 * @param {import('mysql2/promise').Connection | import('./mysql-vilareal.mjs').DockerMysqlAdapter} conn
 * @param {number} codNum
 * @param {string} baseBanco
 */
export async function diagnosticarClienteStub(conn, codNum, baseBanco) {
  const cod8 = String(codNum).padStart(8, '0');
  const [cli] = await conn.query(
    `SELECT c.pessoa_id FROM cliente c
     WHERE TRIM(c.codigo_cliente) = ? OR TRIM(c.codigo_cliente) = ? LIMIT 1`,
    [cod8, String(codNum)]
  );
  if (!cli?.length) {
    return { cliente: codNum, erro: 'cliente_nao_cadastrado' };
  }

  const pessoaId = Number(cli[0].pessoa_id);
  const dropbox = listarProcessosDropboxCliente(baseBanco, codNum);
  const medidas = await medirTamanhoClienteMysqlRapido(conn, pessoaId, cod8, dropbox);
  const stub = await listarProcessosStubLimpeza(conn, pessoaId, dropbox, {
    codNum,
    baseBanco,
    exigirPastaProc: true,
  });

  const estimativaBytes =
    medidas.andamentos * 340 +
    medidas.processosMysql * 1200 +
    medidas.calculoBytes +
    medidas.partes * 300;

  return {
    cliente: codNum,
    codigoCliente8: cod8,
    pessoaId,
    pastaProc: pastaProcClienteExiste(baseBanco, codNum),
    ...medidas,
    stubLimpeza: stub.candidatos.length,
    stubNumeros: stub.candidatos.map((c) => c.ni).slice(0, 40),
    skipLimpeza: stub.motivoSkip,
    estimativaMb: Math.round((estimativaBytes / 1024 / 1024) * 100) / 100,
  };
}
