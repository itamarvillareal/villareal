/**
 * Consulta e filtro compartilhados — processos vazios sem sucessor válido.
 */

import { formatCod8 } from './historico-local-txt-paths.mjs';

export const SQL_PROCESSOS_VAZIOS_BASE = `
SELECT
  p.id AS processo_id,
  TRIM(c.codigo_cliente) AS codigo_cliente,
  CAST(TRIM(LEADING '0' FROM c.codigo_cliente) AS UNSIGNED) AS codigo_cliente_num,
  p.numero_interno,
  p.ativo,
  p.fase,
  p.natureza_acao,
  p.created_at,
  p.updated_at,
  EXISTS (
    SELECT 1 FROM processo_andamento pa WHERE pa.processo_id = p.id
  ) AS tem_andamento,
  (
    p.numero_cnj IS NOT NULL AND TRIM(p.numero_cnj) <> ''
  ) AS tem_cnj,
  (
    p.numero_processo_antigo IS NOT NULL AND TRIM(p.numero_processo_antigo) <> ''
  ) AS tem_num_antigo,
  (
    p.unidade IS NOT NULL AND TRIM(p.unidade) <> ''
  ) AS tem_unidade,
  EXISTS (
    SELECT 1 FROM processo_parte pp
    WHERE pp.processo_id = p.id AND UPPER(TRIM(pp.polo)) = 'REU'
  ) AS tem_reu,
  EXISTS (
    SELECT 1 FROM calculo_rodada cr
    WHERE TRIM(cr.codigo_cliente) = TRIM(c.codigo_cliente)
      AND cr.numero_processo = p.numero_interno
      AND cr.dimensao = 0
  ) AS tem_calculo_dim0,
  EXISTS (
    SELECT 1 FROM processo p_ant
    INNER JOIN cliente c_ant ON c_ant.id = p_ant.cliente_id
    WHERE p_ant.cliente_id = p.cliente_id
      AND p_ant.numero_interno < p.numero_interno
      AND p_ant.numero_interno >= 1
      AND (
        EXISTS (SELECT 1 FROM processo_andamento pa WHERE pa.processo_id = p_ant.id)
        OR (p_ant.numero_cnj IS NOT NULL AND TRIM(p_ant.numero_cnj) <> '')
        OR (p_ant.numero_processo_antigo IS NOT NULL AND TRIM(p_ant.numero_processo_antigo) <> '')
        OR (p_ant.unidade IS NOT NULL AND TRIM(p_ant.unidade) <> '')
        OR EXISTS (
          SELECT 1 FROM processo_parte pp
          WHERE pp.processo_id = p_ant.id AND UPPER(TRIM(pp.polo)) = 'REU'
        )
        OR EXISTS (
          SELECT 1 FROM calculo_rodada cr
          WHERE TRIM(cr.codigo_cliente) = TRIM(c_ant.codigo_cliente)
            AND cr.numero_processo = p_ant.numero_interno
            AND cr.dimensao = 0
        )
      )
  ) AS tem_valido_anterior,
  (
    SELECT COUNT(*)
    FROM processo px
    WHERE px.cliente_id = p.cliente_id AND px.numero_interno >= 1
  ) AS total_processos_cliente
FROM processo p
INNER JOIN cliente c ON c.id = p.cliente_id
WHERE p.numero_interno >= 1
`.trim();

/** @param {unknown} v */
export function asBool(v) {
  return v === 1 || v === true || v === '1';
}

/** @param {Record<string, unknown>} row @param {'judicial' | 'completo'} criterio */
export function processoValidoPorCriterio(row, criterio) {
  const temAndamento = asBool(row.tem_andamento);
  const temCnj = asBool(row.tem_cnj);
  const temNumAntigo = asBool(row.tem_num_antigo);
  if (temAndamento || temCnj || temNumAntigo) return true;
  if (criterio !== 'completo') return false;
  return asBool(row.tem_unidade) || asBool(row.tem_reu) || asBool(row.tem_calculo_dim0);
}

/** @param {Record<string, unknown>} row @param {'judicial' | 'completo'} criterio */
export function processoVazioPorCriterio(row, criterio) {
  const semJudicial =
    !asBool(row.tem_andamento) && !asBool(row.tem_cnj) && !asBool(row.tem_num_antigo);
  if (!semJudicial) return false;
  if (criterio !== 'completo') return true;
  return (
    !asBool(row.tem_unidade) &&
    !asBool(row.tem_reu) &&
    !asBool(row.tem_calculo_dim0)
  );
}

/** @param {Record<string, unknown>} row @param {'judicial' | 'completo'} criterio */
export function normalizarRowProcessoVazio(row, criterio) {
  const codigoClienteNum = Number(row.codigo_cliente_num);
  return {
    processoId: Number(row.processo_id),
    codigoCliente: String(row.codigo_cliente ?? '').trim(),
    codigoClienteNum,
    codigoCliente8: formatCod8(codigoClienteNum),
    numeroInterno: Number(row.numero_interno),
    ativo: asBool(row.ativo),
    fase: row.fase ?? null,
    naturezaAcao: row.natureza_acao ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    temAndamento: asBool(row.tem_andamento),
    temCnj: asBool(row.tem_cnj),
    temNumAntigo: asBool(row.tem_num_antigo),
    temUnidade: asBool(row.tem_unidade),
    temReu: asBool(row.tem_reu),
    temCalculoDim0: asBool(row.tem_calculo_dim0),
    processoValido: processoValidoPorCriterio(row, criterio),
    processoVazio: processoVazioPorCriterio(row, criterio),
    temValidoAnterior: asBool(row.tem_valido_anterior),
    totalProcessosCliente: Number(row.total_processos_cliente ?? 0),
  };
}

/**
 * @param {ReturnType<typeof normalizarRowProcessoVazio>[]} rows
 * @param {{ cliente?: number | null, somenteClienteSemValido?: boolean }} opts
 */
export function filtrarProcessosVaziosAlvo(rows, opts = {}) {
  let out = rows.filter((r) => r.processoVazio);
  out = out.filter((r) => {
    const temSucessorValido = rows.some(
      (o) =>
        o.codigoCliente === r.codigoCliente &&
        o.numeroInterno > r.numeroInterno &&
        o.processoValido
    );
    return !temSucessorValido;
  });
  if (opts.cliente != null && Number.isFinite(opts.cliente)) {
    out = out.filter((r) => r.codigoClienteNum === opts.cliente);
  }
  if (opts.somenteClienteSemValido) {
    const clientesComValido = new Set(
      rows.filter((r) => r.processoValido).map((r) => r.codigoCliente)
    );
    out = out.filter((r) => !clientesComValido.has(r.codigoCliente));
  }
  out.sort((a, b) => a.codigoClienteNum - b.codigoClienteNum || a.numeroInterno - b.numeroInterno);
  return out;
}

/**
 * @param {import('mysql2/promise').Connection | import('./mysql-vilareal.mjs').DockerMysqlAdapter} conn
 * @param {{ criterioValido?: 'judicial' | 'completo', cliente?: number | null, somenteClienteSemValido?: boolean }} opts
 */
export async function carregarProcessosVaziosAlvo(conn, opts = {}) {
  const criterioValido = opts.criterioValido === 'completo' ? 'completo' : 'judicial';
  const [rows] = await conn.query(SQL_PROCESSOS_VAZIOS_BASE);
  const todos = rows.map((r) => normalizarRowProcessoVazio(r, criterioValido));
  if (criterioValido === 'judicial') {
    for (const r of todos) {
      r.temValidoAnterior = todos.some(
        (o) =>
          o.codigoCliente === r.codigoCliente &&
          o.numeroInterno < r.numeroInterno &&
          o.processoValido
      );
    }
  }
  const alvo = filtrarProcessosVaziosAlvo(todos, opts);
  return { criterioValido, todos, alvo };
}
